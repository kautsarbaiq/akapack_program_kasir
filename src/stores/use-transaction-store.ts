import { create } from 'zustand'
import type { Transaction, TransactionItem, PaymentMethod, TransactionStatus, User, Employee } from '@/types'
import { mockTransactions } from '@/lib/mock-data'
import { getSupabaseBrowser } from '@/lib/supabase/client'
import { isSupabaseConfigured, DEFAULT_TENANT_ID } from '@/lib/supabase/config'
import { updateRow } from '@/lib/supabase/repo'
import { toPayload } from '@/lib/stock/stock-sync'
import { useCustomerStore } from './use-customer-store'
import { useEmployeeStore } from './use-employee-store'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (s?: string | null): s is string => !!s && UUID_RE.test(s)

interface TxnItemRow {
  id: string
  transaction_id: string
  product_id: string | null
  product_name: string
  product_price: number
  cost_price: number | null
  quantity: number
  discount: number
  subtotal: number
}

interface TxnRow {
  id: string
  outlet_id: string
  transaction_number: string
  customer_id: string | null
  cashier_id: string | null
  subtotal: number
  discount_amount: number
  tax_amount: number
  service_charge_amount: number
  total: number
  paid_amount: number
  change_amount: number
  payment_method: PaymentMethod
  payment_details: Record<string, number> | null
  status: TransactionStatus
  notes: string | null
  source: string | null
  shipping_cost: number | null
  created_at: string
  transaction_items: TxnItemRow[] | null
}

function empToUser(e?: Employee): User | undefined {
  if (!e) return undefined
  return { id: e.id, email: e.email ?? '', full_name: e.name, role: e.role, is_active: e.is_active, created_at: e.created_at }
}

// false setelah server menolak kolom transactions.stock_lines (migrasi 0026 belum ada) — sesi ini saja.
let stockLinesColumn = true

/** Simpan header transaksi + item-nya. Mengembalikan id (uuid) dari DB, atau null. */
async function persistTransaction(txn: Transaction): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  try {
    const sb = getSupabaseBrowser()
    const { data, error } = await sb
      .from('transactions')
      .insert({
        // Pakai id uuid dari klien bila ada → reference_id pergerakan stok tetap tertaut.
        ...(isUuid(txn.id) ? { id: txn.id } : {}),
        tenant_id: DEFAULT_TENANT_ID,
        outlet_id: isUuid(txn.outlet_id) ? txn.outlet_id : null,
        transaction_number: txn.transaction_number,
        customer_id: isUuid(txn.customer_id) ? txn.customer_id : null,
        cashier_id: isUuid(txn.cashier_id) ? txn.cashier_id : null,
        subtotal: txn.subtotal,
        discount_amount: txn.discount_amount,
        tax_amount: txn.tax_amount,
        service_charge_amount: txn.service_charge_amount,
        total: txn.total,
        paid_amount: txn.paid_amount,
        change_amount: txn.change_amount,
        payment_method: txn.payment_method,
        payment_details: txn.payment_details ?? null, // rincian split (mis. {cash: X, qris: Y}) — dipakai hitung kas laci

        status: txn.status,
        notes: txn.notes ?? null,
        source: txn.source ?? 'pos',
        shipping_cost: txn.shipping_cost ?? 0,
        // Potongan stoknya ikut di nota → server memotong stok saat nota masuk (migrasi 0026), jadi
        // nota yang sampai tak pernah lagi tanpa stok walau antrean stok di perangkat ini hilang.
        ...(txn.stock_lines?.length && stockLinesColumn ? { stock_lines: txn.stock_lines.map(toPayload) } : {}),
        // Waktu jual SEBENARNYA. Tanpa ini server memakai now() → nota yang tertahan di antrean
        // offline tercatat pada jam terkirim (pernah sampai keesokan harinya, TRX-20261021-A0072).
        // Jam perangkat yang kebablasan ke depan dijepit ke sekarang; pesanan toko online memakai jam
        // SERVER (jam HP pembeli tak bisa dipercaya).
        ...(txn.created_at && txn.source !== 'online'
          ? { created_at: new Date(Math.min(Date.parse(txn.created_at) || Date.now(), Date.now())).toISOString() }
          : {}),
      })
      .select('id')
      .single()
    if (error && stockLinesColumn && txn.stock_lines?.length && /stock_lines/.test(error.message || '')) {
      // Server belum punya kolomnya (migrasi 0026 belum dijalankan): kirim tanpa — antrean stok tetap jalan.
      stockLinesColumn = false
      return persistTransaction(txn)
    }
    let txnId: string
    if (error || !data) {
      // IDEMPOTEN: header dgn id ini SUDAH ada (percobaan sebelumnya ter-commit tapi responsnya hilang).
      const dup = error && ((error as { code?: string }).code === '23505' || /duplicate key|already exists/i.test(error.message || ''))
      if (!(dup && isUuid(txn.id))) {
        console.warn('[akapack] gagal simpan transaksi:', error?.message)
        return null
      }
      txnId = txn.id
      // Dulu langsung "sukses" di sini TANPA menyimpan item → 4 nota sejak 7 Sep tersimpan dengan 0 item
      // (mis. TRX-20261021-A0065), omzetnya ada tapi barangnya hilang dari laporan per produk.
      // Item ber-id uuid tetap → di-upsert di bawah (idempoten). Nota lama di antrean (id item bukan
      // uuid) → cek dulu apakah itemnya sudah ada supaya tak dobel.
      if (!txn.items.every((it) => isUuid(it.id))) {
        const { count, error: cntErr } = await sb.from('transaction_items').select('id', { count: 'exact', head: true }).eq('transaction_id', txnId)
        if (cntErr) return null // belum bisa memastikan → ulangi nanti
        if ((count ?? 0) > 0) return txnId
      }
    } else {
      txnId = (data as { id: string }).id
    }
    if (txn.items.length) {
      const rows = txn.items.map((it) => ({
        ...(isUuid(it.id) ? { id: it.id } : {}),
        transaction_id: txnId,
        product_id: isUuid(it.product_id) ? it.product_id : null,
        product_name: it.product_name,
        product_price: it.product_price,
        cost_price: it.cost_price ?? 0,
        quantity: it.quantity,
        discount: it.discount,
        subtotal: it.subtotal,
      }))
      // id item uuid → upsert abaikan-duplikat: kiriman ganda/bersamaan (antrean + kirim pertama) tak
      // pernah menggandakan item (pola TRX-20260828-G0043, omzet tercatat 2×). Satu pernyataan = atomik.
      const allUuid = txn.items.every((it) => isUuid(it.id))
      const write = (rs: typeof rows) => (allUuid
        ? sb.from('transaction_items').upsert(rs, { onConflict: 'id', ignoreDuplicates: true })
        : sb.from('transaction_items').insert(rs))
      let { error: itemsErr } = await write(rows)
      if (itemsErr && (itemsErr as { code?: string }).code === '23503') {
        // Produk sudah DIHAPUS sejak dijual (kasir memegang katalog lama / antrean offline): simpan item
        // tanpa tautan produk — status yang sama dengan ON DELETE SET NULL — supaya nota tak macet di
        // antrean selamanya. Nama & harga item tetap tersimpan.
        const ids = rows.map((r) => r.product_id).filter(Boolean) as string[]
        const { data: alive } = await sb.from('products').select('id').in('id', ids)
        const exists = new Set(((alive ?? []) as { id: string }[]).map((p) => p.id))
        ;({ error: itemsErr } = await write(rows.map((r) => (r.product_id && !exists.has(r.product_id) ? { ...r, product_id: null } : r))))
      }
      if (itemsErr) {
        console.warn('[akapack] gagal simpan item transaksi:', itemsErr.message)
        return null // JANGAN dianggap sukses — antrean akan mengulang & melengkapi itemnya
      }
    }
    return txnId
  } catch (e) {
    console.warn('[akapack] error simpan transaksi:', e)
    return null
  }
}

/** Jendela default riwayat transaksi saat app dibuka — hemat bandwidth (egress).
 *  POS/dashboard cuma butuh data baru; halaman laporan memanggil ensureAll() untuk riwayat penuh. */
const BOOTSTRAP_DAYS = 92

// ── OUTBOX: transaksi yang GAGAL tersimpan (sinyal putus) disimpan di localStorage & dicoba ulang.
// Cegah "penjualan hilang" di POS HP dengan koneksi jelek. Idempoten via id (lihat persistTransaction).
const OUTBOX_KEY = 'akapack-txn-outbox'
function readOutbox(): Transaction[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]') as Transaction[] } catch { return [] }
}
function writeOutbox(list: Transaction[]) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(list)) } catch { /* penuh/nonaktif */ }
}
function enqueueOutbox(txn: Transaction) {
  const list = readOutbox()
  if (!list.some((t) => t.id === txn.id)) { list.push(txn); writeOutbox(list) }
}
function dequeueOutbox(id: string) { writeOutbox(readOutbox().filter((t) => t.id !== id)) }

/** id transaksi yang masih di antrean perangkat ini (belum sampai server) — jangan di-void dulu. */
export function pendingTxnIds(): Set<string> { return new Set(readOutbox().map((t) => t.id)) }

// Nota yang sedang dikirim di tab ini — kirim pertama & pengurasan antrean berkala tak boleh berjalan
// bersamaan untuk nota yang sama (nota lama di antrean dgn id item non-uuid bisa tersimpan dobel).
const inFlight = new Map<string, Promise<string | null>>()

/** Simpan transaksi dengan RETRY (3×, backoff). Return id bila sukses, null bila semua gagal. */
function persistWithRetry(txn: Transaction, tries = 3): Promise<string | null> {
  const running = inFlight.get(txn.id)
  if (running) return running
  const p = persistWithRetryInner(txn, tries).finally(() => { inFlight.delete(txn.id) })
  inFlight.set(txn.id, p)
  return p
}
async function persistWithRetryInner(txn: Transaction, tries: number): Promise<string | null> {
  for (let i = 0; i < tries; i++) {
    const id = await persistTransaction(txn)
    if (id) return id
    if (i < tries - 1) await new Promise((r) => setTimeout(r, 800 * (i + 1)))
  }
  return null
}

interface TransactionStore {
  transactions: Transaction[]
  /** Transaksi terakhir yang sukses — dipakai untuk preview struk */
  lastTransaction: Transaction | null
  loaded: boolean
  /** true bila SEMUA riwayat sudah termuat (bukan hanya jendela 92 hari). */
  allLoaded: boolean
  loading: boolean
  /** Jumlah transaksi yang BELUM tersimpan ke server (menunggu koneksi). */
  pendingCount: number
  fetch: (full?: boolean) => Promise<void>
  /** Muat SEMUA riwayat sekali (dipanggil halaman riwayat/laporan yang butuh data lama). */
  ensureAll: () => void
  addTransaction: (txn: Transaction) => void
  /** Kirim ulang transaksi yang tertunda di outbox (dipanggil saat app dibuka). */
  flushOutbox: () => Promise<void>
  voidTransaction: (id: string) => void
  setStatus: (id: string, status: TransactionStatus) => void
}

let _txnLoad: Promise<void> | null = null // pemuatan yang sedang berjalan (dedup + anti-race window↔full)
export const useTransactionStore = create<TransactionStore>()((set, get) => ({
  transactions: isSupabaseConfigured() ? [] : mockTransactions,
  lastTransaction: null,
  loaded: false,
  allLoaded: false,
  loading: false,
  pendingCount: typeof window !== 'undefined' ? readOutbox().length : 0,

  ensureAll: () => { void get().fetch(true) },

  fetch: async (full = false) => {
    if (!isSupabaseConfigured()) {
      set({ loaded: true, allLoaded: true })
      return
    }
    // Sudah punya SEMUA data → jendela (full=false) tak perlu memuat ulang / menurunkan cakupan.
    if (get().allLoaded && !full) return
    // Ada pemuatan berjalan → tunggu; kalau setelahnya cakupan sudah cukup, berhenti.
    // Ini mencegah RACE: ensureAll (full) yang datang saat jendela (bootstrap) sedang jalan
    // tak lagi di-skip diam-diam → riwayat penuh SELALU jadi dimuat.
    const inflight = _txnLoad
    if (inflight) { await inflight.catch(() => {}); if (!full || get().allLoaded) return }
    const p = (async () => {
    set({ loading: true })
    try {
      const sb = getSupabaseBrowser()
      const since = new Date(Date.now() - BOOTSTRAP_DAYS * 86400000).toISOString()
      // Paginasi: PostgREST membatasi 1000 baris/permintaan — tanpa ini transaksi lama (>1000) hilang.
      const rows: TxnRow[] = []
      for (let from = 0; ; from += 1000) {
        let q = sb
          .from('transactions')
          .select('*, transaction_items(*)')
          .order('created_at', { ascending: false }).order('id', { ascending: true }) // tie-break unik: created_at bisa kembar (batch insert)
          .range(from, from + 999)
        if (!full) q = q.gte('created_at', since) // jendela hemat-data; laporan pakai ensureAll()
        const { data, error } = await q
        if (error) { if (from === 0) { set({ loaded: true, loading: false }); return } break }
        const page = (data ?? []) as unknown as TxnRow[]
        rows.push(...page)
        if (page.length < 1000) break
      }
      const customers = useCustomerStore.getState().customers
      const employees = useEmployeeStore.getState().employees
      const mapped: Transaction[] = rows.map((r) => {
        const items: TransactionItem[] = (r.transaction_items ?? []).map((it) => ({
          id: it.id,
          transaction_id: it.transaction_id,
          product_id: it.product_id ?? '',
          product_name: it.product_name,
          product_price: it.product_price,
          cost_price: it.cost_price ?? 0,
          quantity: it.quantity,
          discount: it.discount,
          subtotal: it.subtotal,
        }))
        return {
          id: r.id,
          outlet_id: r.outlet_id,
          transaction_number: r.transaction_number,
          customer_id: r.customer_id ?? undefined,
          customer: customers.find((c) => c.id === r.customer_id),
          cashier_id: r.cashier_id ?? '',
          cashier: empToUser(employees.find((e) => e.id === r.cashier_id)),
          items,
          subtotal: r.subtotal,
          discount_amount: r.discount_amount,
          tax_amount: r.tax_amount,
          service_charge_amount: r.service_charge_amount,
          total: r.total,
          paid_amount: r.paid_amount,
          change_amount: r.change_amount,
          payment_method: r.payment_method,
          payment_details: r.payment_details ?? undefined,
          status: r.status,
          notes: r.notes ?? undefined,
          source: (r.source as 'pos' | 'online') ?? undefined,
          shipping_cost: r.shipping_cost ?? undefined,
          created_at: r.created_at,
        }
      })
      set({ transactions: mapped, loaded: true, allLoaded: full, loading: false })
    } catch {
      set({ loaded: true, loading: false })
    }
    })()
    _txnLoad = p
    try { await p } finally { if (_txnLoad === p) _txnLoad = null }
  },

  addTransaction: (txn) => {
    set((s) => ({ transactions: [txn, ...s.transactions], lastTransaction: txn }))
    // WRITE-AHEAD: nota ditulis ke antrean perangkat SEBELUM kiriman pertama, dihapus setelah server
    // mengonfirmasi. Dulu baru masuk antrean setelah 3 percobaan gagal (±2,4 dtk) — tab tertutup di
    // jeda itu = nota hilang. Idempoten via id, jadi kiriman ulang tak menggandakan.
    if (isSupabaseConfigured() && isUuid(txn.id)) enqueueOutbox(txn) // pendingCount baru naik bila kiriman gagal
    void persistWithRetry(txn).then((newId) => {
      if (!newId) {
        // Semua percobaan gagal (sinyal putus) → tetap di OUTBOX, dikirim ulang nanti. Transaksi TIDAK hilang.
        enqueueOutbox(txn)
        set({ pendingCount: readOutbox().length })
        if (isSupabaseConfigured() && typeof window !== 'undefined') {
          import('sonner').then(({ toast }) => toast.warning('Koneksi bermasalah — transaksi disimpan sementara & otomatis dikirim ulang saat online.', { duration: 8000 }))
        }
        return
      }
      dequeueOutbox(txn.id)
      set({ pendingCount: readOutbox().length })
      set((s) => ({
        transactions: s.transactions.map((t) => (t.id === txn.id ? { ...t, id: newId } : t)),
        lastTransaction: s.lastTransaction && s.lastTransaction.id === txn.id
          ? { ...s.lastTransaction, id: newId }
          : s.lastTransaction,
      }))
    })
  },

  flushOutbox: async () => {
    const pending = readOutbox()
    if (!pending.length) return
    let ok = 0
    for (const txn of pending) {
      const id = await persistWithRetry(txn, 2)
      if (id) { dequeueOutbox(txn.id); ok++ }
    }
    set({ pendingCount: readOutbox().length })
    if (ok > 0 && typeof window !== 'undefined') {
      import('sonner').then(({ toast }) => toast.success(`${ok} transaksi tertunda berhasil dikirim ke server.`))
    }
  },

  // Status void di SERVER ditulis oleh fungsi void_sale_with_stock (bersama pembalik stoknya, di bawah
  // kunci status). Di sini hanya menandai di memori setelah server mengonfirmasi.
  voidTransaction: (id) => {
    set((s) => ({
      transactions: s.transactions.map((t) => (t.id === id ? { ...t, status: 'void' } : t)),
    }))
  },

  setStatus: (id, status) => {
    set((s) => ({
      transactions: s.transactions.map((t) => (t.id === id ? { ...t, status } : t)),
    }))
    if (isUuid(id)) void updateRow('transactions', id, { status })
  },
}))

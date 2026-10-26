import type { MovementType } from '@/types'
import { getSupabaseBrowser } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'

/**
 * SINKRON STOK — satu-satunya jalan stok berubah ke server.
 *
 * Tiap perubahan dikirim sebagai "baris" ke fungsi DB apply_stock_movements (migrasi 0024), yang
 * dalam SATU transaksi mengunci stok, menghitung sebelum/sesudah YANG SEBENARNYA, mengubah stok, dan
 * menulis riwayatnya. Akibatnya:
 *  - tak mungkin stok berubah tanpa riwayat (dulu riwayat dikirim terpisah sekali jalan → 176 hilang);
 *  - label "Sisa Stok" selalu angka server, bukan salinan basi di perangkat;
 *  - id baris = kunci idempoten: kirim ulang setelah respons hilang tidak memotong stok 2×.
 *
 * Baris "tahan lama" (penjualan POS, transfer, stok masuk/keluar) DITULIS DULU ke localStorage sebelum
 * dikirim (write-ahead), baru dihapus setelah server mengonfirmasi. Penjualan saat sinyal putus tidak
 * lagi hilang — dulu hanya struknya yang selamat lewat antrean, potongan stok & riwayatnya hilang.
 */

export interface StockLine {
  /** uuid pergerakan = kunci idempoten. Pakai newMovementId() atau stableUuid(...) untuk dokumen. */
  id: string
  outlet_id: string
  product_id: string
  variant_id?: string | null
  /** Perubahan bertanda dalam SATUAN DASAR (qty × faktor). Abaikan bila set_to diisi. */
  delta?: number
  /** Angka absolut (opname/SO/ubah dari form) — selisihnya dihitung server di bawah kunci. */
  set_to?: number
  type: MovementType
  notes?: string
  reference_id?: string | null
  created_at?: string
  /** false = server menolak bila hasil < 0 (transfer keluar, stok keluar). Default true (POS boleh minus). */
  allow_negative?: boolean
  /** Kontrol konkurensi untuk angka yang diketik user: tolak bila stok server sudah berubah. */
  expect_before?: number | null
}

export interface StockResult {
  movement_id: string
  before_stock: number
  after_stock: number
  quantity: number
  /** false = id ini sudah pernah diterapkan (kiriman ulang) — stok tidak disentuh lagi. */
  applied: boolean
}

export interface StockFailure { line: StockLine; code: string; message: string }

interface OutboxEntry {
  key: string
  lines: StockLine[]
  createdAt: string
  attempts: number
  lastError?: string
  /** true = baris-barisnya WAJIB diterapkan bersama (transfer dua sisi, posting dokumen) — tak boleh dipecah. */
  atomic?: boolean
}

interface DeadEntry extends OutboxEntry { failedAt: string; code: string }

// Tiap entri antrean disimpan di kuncinya SENDIRI ('akapack-stock-outbox:<key>'), bukan satu daftar
// bersama: dua tab di perangkat yang sama tak bisa lagi saling menimpa (baca-ubah-tulis daftar bersama
// bisa menghilangkan entri tab lain = potongan stok satu nota lenyap).
const OUTBOX_PREFIX = 'akapack-stock-outbox:'
const LEGACY_OUTBOX_KEY = 'akapack-stock-outbox'
const DEAD_KEY = 'akapack-stock-deadletter'
const UNSENDABLE_TTL_MS = 24 * 3600 * 1000 // baris ber-id sementara yang tak pernah jadi uuid → disisihkan
const MAX_LINES_PER_CALL = 200 // anon statement_timeout 3 dtk; 500 baris ±4 ms, tapi bisa antre di belakang impor

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (s?: string | null): s is string => !!s && UUID_RE.test(s)

// ── id ────────────────────────────────────────────────────────────────────────────────────────

export function newMovementId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  // Peramban sangat lama: tetap uuid valid (bukan prefiks 'mov-') supaya server menerimanya.
  const b = new Uint8Array(16)
  for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  return toUuid(b)
}

/**
 * uuid DETERMINISTIK dari teks — untuk posting dokumen ('po-post:<docId>:<productId>') supaya
 * dokumen yang terposting dua kali (dua perangkat, atau status yang gagal tersimpan) tetap hanya
 * mengubah stok sekali: id yang sama → server mengembalikan hasil lama.
 * Hash 128-bit (4× murmur3-fmix, seed berbeda) — bukan kriptografis, cukup untuk mencegah tabrakan.
 */
export function stableUuid(seed: string): string {
  const h = (s: number) => {
    let x = s >>> 0
    for (let i = 0; i < seed.length; i++) {
      x = Math.imul(x ^ seed.charCodeAt(i), 0x5bd1e995)
      x ^= x >>> 15
    }
    x ^= seed.length
    x = Math.imul(x ^ (x >>> 16), 0x85ebca6b)
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35)
    return (x ^ (x >>> 16)) >>> 0
  }
  const words = [h(0x9e3779b9), h(0x7f4a7c15), h(0x94d049bb), h(0xbf58476d)]
  const b = new Uint8Array(16)
  words.forEach((w, i) => { b[i * 4] = w >>> 24; b[i * 4 + 1] = (w >>> 16) & 255; b[i * 4 + 2] = (w >>> 8) & 255; b[i * 4 + 3] = w & 255 })
  b[6] = (b[6] & 0x0f) | 0x50 // "versi 5"-ish: deterministik
  b[8] = (b[8] & 0x3f) | 0x80
  return toUuid(b)
}

function toUuid(b: Uint8Array): string {
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

// ── penyimpanan antrean ─────────────────────────────────────────────────────────────────────────

// Cadangan di memori kalau localStorage penuh / mode privat — antrean tetap jalan selama tab hidup.
const memEntries = new Map<string, OutboxEntry>()

function readList<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(key) || '[]') as T[] } catch { return [] }
}
function writeList<T>(key: string, list: T[]): boolean {
  if (typeof window === 'undefined') return false
  try { localStorage.setItem(key, JSON.stringify(list)); return true } catch { return false }
}

function putEntry(e: OutboxEntry) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(OUTBOX_PREFIX + e.key, JSON.stringify(e)); memEntries.delete(e.key) }
  catch {
    memEntries.set(e.key, e)
    warnOnce('Penyimpanan perangkat penuh/nonaktif — antrean stok hanya bertahan selama tab ini terbuka. Jangan tutup tab sampai tersinkron.')
  }
}
function removeEntry(key: string) {
  memEntries.delete(key)
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(OUTBOX_PREFIX + key) } catch { /* abaikan */ }
}

function readOutbox(): OutboxEntry[] {
  if (typeof window === 'undefined') return []
  // Format lama (satu daftar) → pindahkan ke kunci per entri. Dicek tiap baca (satu getItem, murah):
  // tab versi lama di perangkat yang sama bisa menulisnya kapan saja.
  try {
    if (localStorage.getItem(LEGACY_OUTBOX_KEY)) {
      const old = readList<OutboxEntry>(LEGACY_OUTBOX_KEY)
      localStorage.removeItem(LEGACY_OUTBOX_KEY)
      old.forEach(putEntry)
    }
  } catch { /* abaikan */ }
  const out = new Map<string, OutboxEntry>()
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || !k.startsWith(OUTBOX_PREFIX)) continue
      try { const e = JSON.parse(localStorage.getItem(k) || 'null') as OutboxEntry | null; if (e?.key) out.set(e.key, e) } catch { /* entri rusak */ }
    }
  } catch { /* localStorage tak bisa dibaca */ }
  memEntries.forEach((e, k) => out.set(k, e))
  return [...out.values()].sort((x, y) => (x.createdAt === y.createdAt ? (x.key < y.key ? -1 : 1) : x.createdAt < y.createdAt ? -1 : 1))
}

/** Semua baris yang belum dikonfirmasi server, urut FIFO — dipakai memproyeksikan stok lokal. */
export function pendingStockLines(): StockLine[] { return readOutbox().flatMap((e) => e.lines) }
export function stockOutboxCount(): number { return readOutbox().reduce((n, e) => n + e.lines.length, 0) }
export function deadLetters(): DeadEntry[] { return readList<DeadEntry>(DEAD_KEY) }

/** Produk/varian baru: id sementara → uuid. Baris antrean yang memakai id lama ikut diganti. */
export function remapQueuedIds(kind: 'product' | 'variant', oldId: string, newId: string) {
  for (const e of readOutbox()) {
    let touched = false
    const lines = e.lines.map((l) => {
      if (kind === 'product' && l.product_id === oldId) { touched = true; return { ...l, product_id: newId } }
      if (kind === 'variant' && l.variant_id === oldId) { touched = true; return { ...l, variant_id: newId } }
      return l
    })
    if (touched) putEntry({ ...e, lines })
  }
  void flushStockOutbox()
}

/** Kirim ulang baris yang disisihkan (mis. setelah produk dipulihkan / koneksi beres). */
export function retryDeadLetters() {
  const dead = deadLetters()
  if (!dead.length) return
  writeList(DEAD_KEY, [])
  dead.forEach((d) => putEntry({ key: d.key, lines: d.lines, createdAt: d.createdAt, attempts: 0, atomic: d.atomic }))
  notifyQueue()
  void flushStockOutbox()
}
/** Buang baris yang disisihkan (pemilik memutuskan tidak dipakai). */
export function discardDeadLetters() { writeList(DEAD_KEY, []); notifyQueue() }

// ── "stok berubah" — store produk/varian memproyeksikan ulang angka yang ditampilkan ──────────────
// Sengaja di modul daun ini (tak mengimpor store): pendaftaran terjadi saat modul store dimuat, dan
// registri di modul store yang terlibat impor melingkar bisa belum terinisialisasi (TDZ → crash).
const reconciledListeners = new Set<() => void>()
export function onStockReconciled(cb: () => void) { reconciledListeners.add(cb); return () => { reconciledListeners.delete(cb) } }
// Digabung per tick: satu penjualan bisa memicu beberapa kali (optimis + jawaban server) — proyeksi ulang
// ±4.200 produk cukup sekali.
let emitScheduled = false
export function emitStockReconciled() {
  if (emitScheduled) return
  emitScheduled = true
  queueMicrotask(() => {
    emitScheduled = false
    reconciledListeners.forEach((cb) => { try { cb() } catch { /* abaikan */ } })
  })
}

// ── kait ke store (didaftarkan sekali oleh use-inventory-store; hindari import melingkar) ─────────

interface Handlers {
  /** Server mengonfirmasi baris-baris ini → samakan memori dengan angka server. */
  onApplied: (lines: StockLine[], results: StockResult[]) => void
  /** Baris ditolak (permanen dari antrean, atau gagal saat kirim langsung) → batalkan efek optimisnya.
   *  interactive=true: pemanggil (impor/opname/form) yang memberi tahu pengguna, jangan toast dobel. */
  onRejected: (lines: StockLine[], code: string, message: string, interactive: boolean) => void
  /** Jumlah antrean berubah (untuk lencana "menunggu sinyal"). */
  onQueueChange?: (pending: number, dead: number) => void
}
let handlers: Handlers | null = null
export function registerStockSyncHandlers(h: Handlers) { handlers = h }
function notifyQueue() { handlers?.onQueueChange?.(stockOutboxCount(), deadLetters().reduce((n, d) => n + d.lines.length, 0)) }

let warned = false
function warnOnce(msg: string) {
  if (warned || typeof window === 'undefined') return
  warned = true
  void import('sonner').then(({ toast }) => toast.warning(msg, { duration: 12000 }))
}

// ── klasifikasi error ──────────────────────────────────────────────────────────────────────────

/**
 * PERMANEN = data/aturan (diulang pun tetap gagal): 22xxx (input), 23xxx (FK/duplikat beda isi),
 * P0001 (STOK_KURANG / STOK_BERUBAH), P0002. Selain itu (jaringan, 5xx, timeout 57014, deadlock
 * 40P01, serialisasi 40001, PGRST202 fungsi belum ada saat deploy berselisih) = SEMENTARA → ulangi
 * dengan id yang SAMA, aman karena idempoten.
 */
function isPermanent(code: string): boolean {
  if (!code) return false
  if (code === 'PGRST202' || code.startsWith('PGRST')) return false
  return code.startsWith('22') || code.startsWith('23') || code === 'P0001' || code === 'P0002'
}

// ── kirim ──────────────────────────────────────────────────────────────────────────────────────

function toPayload(l: StockLine) {
  return {
    id: l.id,
    outlet_id: l.outlet_id,
    product_id: l.product_id,
    variant_id: l.variant_id ?? null,
    delta: l.set_to != null ? null : Math.round(l.delta ?? 0),
    set_to: l.set_to != null ? Math.max(0, Math.round(l.set_to)) : null,
    type: l.type,
    notes: l.notes ?? null,
    reference_id: isUuid(l.reference_id) ? l.reference_id : null,
    created_at: l.created_at ?? null,
    allow_negative: l.allow_negative ?? true,
    expect_before: l.expect_before ?? null,
  }
}

type CallOutcome =
  | { ok: true; results: StockResult[] }
  | { ok: false; permanent: boolean; code: string; message: string }

async function callRpc(lines: StockLine[]): Promise<CallOutcome> {
  try {
    const { data, error } = await getSupabaseBrowser().rpc('apply_stock_movements', { p_lines: lines.map(toPayload) })
    if (error) {
      const code = (error as { code?: string }).code ?? ''
      return { ok: false, permanent: isPermanent(code), code, message: error.message || 'gagal' }
    }
    return { ok: true, results: (Array.isArray(data) ? data : []) as StockResult[] }
  } catch (e) {
    return { ok: false, permanent: false, code: '', message: e instanceof Error ? e.message : String(e) }
  }
}

/** Baris yang boleh dikirim: semua id wajib uuid (produk baru yang id-nya masih sementara ditunda). */
function sendable(l: StockLine) {
  return isUuid(l.id) && isUuid(l.outlet_id) && isUuid(l.product_id) && (!l.variant_id || isUuid(l.variant_id))
    && (l.set_to != null || Math.round(l.delta ?? 0) !== 0)
}

// ── antrean tahan-offline ─────────────────────────────────────────────────────────────────────

/**
 * Masukkan baris ke antrean (DITULIS DULU sebelum dikirim), lalu coba kirim segera.
 * Baris dengan delta 0 dibuang (server menolak delta 0 tanpa set_to).
 * atomic=true: semua baris wajib diterapkan bersama (tak dipecah walau ada yang ditolak).
 */
export function enqueueStock(lines: StockLine[], opts: { atomic?: boolean } = {}): void {
  const clean = lines.filter((l) => l.set_to != null || Math.round(l.delta ?? 0) !== 0)
  if (!clean.length) return
  if (!isSupabaseConfigured()) return
  const createdAt = new Date().toISOString()
  for (let i = 0; i < clean.length; i += MAX_LINES_PER_CALL) {
    const part = clean.slice(i, i + MAX_LINES_PER_CALL)
    putEntry({ key: part[0].id, lines: part, createdAt, attempts: 0, atomic: opts.atomic })
  }
  notifyQueue()
  void flushStockOutbox()
}

let flushing: Promise<void> | null = null
let again = false

/** Kirim isi antrean FIFO. Aman dipanggil berkali-kali (diserialisasi per tab & antar tab). */
export function flushStockOutbox(): Promise<void> {
  if (typeof window === 'undefined' || !isSupabaseConfigured()) return Promise.resolve()
  if (flushing) { again = true; return flushing }
  const run = async () => {
    do {
      again = false
      const locks = (navigator as Navigator & { locks?: { request: (n: string, cb: () => Promise<void>) => Promise<void> } }).locks
      if (locks?.request) await locks.request('akapack-stock-outbox', drain)
      else await drain()
    } while (again)
  }
  flushing = run().finally(() => { flushing = null; notifyQueue() })
  return flushing
}

function deadLetter(entry: OutboxEntry, code: string, message: string) {
  const dead = deadLetters()
  dead.push({ ...entry, attempts: entry.attempts + 1, lastError: message, code, failedAt: new Date().toISOString() })
  writeList(DEAD_KEY, dead.slice(-200))
}

async function drain(): Promise<void> {
  for (;;) {
    const list = readOutbox()
    // Baris ber-id sementara (produk yang gagal tersimpan) yang tak kunjung jadi uuid: sisihkan setelah
    // 24 jam supaya lencana "menunggu sinyal" tak menyala selamanya.
    const now = Date.now()
    for (const e of list) {
      if (!e.lines.every(sendable) && now - Date.parse(e.createdAt) > UNSENDABLE_TTL_MS) {
        removeEntry(e.key)
        deadLetter(e, 'LOCAL', 'produk/varian tak pernah tersimpan di server')
        handlers?.onRejected(e.lines, 'LOCAL', 'produk/varian tak pernah tersimpan di server', false)
      }
    }
    // Lewati entri yang belum bisa dikirim (id produk masih sementara) tanpa memblokir yang lain.
    const entry = readOutbox().find((e) => e.lines.every(sendable))
    if (!entry) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return

    const out = await callRpc(entry.lines)
    if (out.ok) {
      removeEntry(entry.key)
      notifyQueue()
      handlers?.onApplied(entry.lines, out.results)
      continue
    }
    if (out.permanent) {
      if (entry.lines.length > 1 && !entry.atomic) {
        // Satu baris ditolak (mis. produk terhapus) JANGAN menyeret seluruh nota: pecah per baris dengan
        // id SAMA (idempoten) di posisi antrean yang sama; hanya baris yang memang ditolak yang disisihkan.
        entry.lines.forEach((l, i) => putEntry({ key: `${entry.key}#${String(i).padStart(3, '0')}`, lines: [l], createdAt: entry.createdAt, attempts: entry.attempts }))
        removeEntry(entry.key)
        continue
      }
      removeEntry(entry.key)
      deadLetter(entry, out.code, out.message)
      notifyQueue()
      handlers?.onRejected(entry.lines, out.code, out.message, false)
      continue // satu entri rusak tidak boleh memblokir antrean selamanya
    }
    // Sementara (sinyal/timeout): catat percobaannya & berhenti — dicoba lagi saat online/interval berikut.
    // Hanya bila entrinya MASIH ada: entri yang sudah dihapus selama menunggu tak boleh dihidupkan lagi.
    if (readOutbox().some((e) => e.key === entry.key)) putEntry({ ...entry, attempts: entry.attempts + 1, lastError: out.message })
    return
  }
}

// ── kirim langsung (impor, opname, transfer, form) — pengguna menunggu hasilnya ──────────────────

const rowOf = (l: StockLine) => `${l.outlet_id}|${l.product_id}|${l.variant_id ?? ''}`

/**
 * Kirim per potongan ≤200 baris; tiap potongan diulang (id SAMA → aman) bila gagal sementara.
 *
 * Tiga hasil per baris:
 *  - results : diterapkan server (angka sebenarnya);
 *  - failed  : DITOLAK server / tak bisa dikirim → tidak ada yang tertulis, efek optimis dibatalkan;
 *  - queued  : hasil BELUM PASTI (koneksi putus — bisa jadi server sudah menyimpan tapi jawabannya hilang).
 *              Baris dipindah ke antrean dengan id yang SAMA dan dikirim otomatis → diterapkan tepat sekali.
 *              Dulu kasus ini dilaporkan "gagal, tidak ada yang tersimpan", pengguna mengulang dengan id
 *              baru, dan transfer/stok masuk-keluar terjadi DUA KALI.
 *
 * set_to (opname/SO/form) dikirim SETELAH antrean perangkat ini kosong untuk barang yang sama — kalau
 * tidak, penjualan yang masih antre akan terpotong lagi setelah angka hitungan ditetapkan.
 */
export async function applyStockNow(
  lines: StockLine[],
  opts: { atomic?: boolean; tries?: number } = {},
): Promise<{ results: StockResult[]; failed: StockFailure[]; queued: StockLine[] }> {
  const results: StockResult[] = []
  const failed: StockFailure[] = []
  const queued: StockLine[] = []
  const tries = opts.tries ?? 3
  let clean = lines.filter((l) => l.set_to != null || Math.round(l.delta ?? 0) !== 0)
  if (!isSupabaseConfigured()) return { results, failed, queued }

  if (clean.some((l) => l.set_to != null)) {
    await flushStockOutbox()
    const busyRows = new Set(pendingStockLines().map(rowOf))
    const blocked = clean.filter((l) => l.set_to != null && busyRows.has(rowOf(l)))
    if (blocked.length) {
      const msg = 'masih ada perubahan stok barang ini yang menunggu sinyal di perangkat ini — tunggu tersinkron lalu simpan lagi'
      blocked.forEach((line) => failed.push({ line, code: 'PENDING_ROWS', message: msg }))
      handlers?.onRejected(blocked, 'PENDING_ROWS', msg, true)
      const blockedIds = new Set(blocked.map((l) => l.id))
      clean = clean.filter((l) => !blockedIds.has(l.id))
    }
  }

  for (let i = 0; i < clean.length; i += MAX_LINES_PER_CALL) {
    const part = clean.slice(i, i + MAX_LINES_PER_CALL)
    const bad = part.filter((l) => !sendable(l))
    const ok = part.filter(sendable)
    if (bad.length) {
      const msg = 'id produk/outlet belum tersimpan di server'
      bad.forEach((line) => failed.push({ line, code: 'LOCAL', message: msg }))
      handlers?.onRejected(bad, 'LOCAL', msg, true) // batalkan efek optimisnya juga
    }
    if (!ok.length) continue
    let out: CallOutcome = { ok: false, permanent: false, code: '', message: '' }
    for (let t = 0; t < tries; t++) {
      out = await callRpc(ok)
      if (out.ok || out.permanent) break
      if (t < tries - 1) await new Promise((r) => setTimeout(r, 700 * (t + 1)))
    }
    if (out.ok) {
      results.push(...out.results)
      handlers?.onApplied(ok, out.results)
    } else if (out.permanent) {
      // Satu potongan = satu transaksi DB: ditolak → TIDAK ADA baris di potongan itu yang tertulis.
      ok.forEach((line) => failed.push({ line, code: out.ok ? '' : out.code, message: out.ok ? '' : out.message }))
      handlers?.onRejected(ok, out.ok ? '' : out.code, out.ok ? '' : out.message, true)
    } else {
      // BELUM PASTI → antrean (id sama, utuh/atomik) — efek optimis dipertahankan, dikirim otomatis.
      enqueueStock(ok, { atomic: true })
      queued.push(...ok)
    }
  }
  return { results, failed, queued }
}

/** Pesan manusiawi untuk kode penolakan server. */
export function describeStockError(code: string, message: string): string {
  if (/STOK_KURANG/.test(message)) return `Stok tidak cukup di server (${message.replace(/^.*STOK_KURANG:\s*/, '')})`
  if (/STOK_BERUBAH/.test(message)) return `Stok sudah berubah di perangkat lain (${message.replace(/^.*STOK_BERUBAH:\s*/, '')}). Muat ulang lalu hitung lagi.`
  if (code === '23503') return 'Produk/varian sudah dihapus'
  if (!code) return 'Koneksi bermasalah'
  return message
}

// ── void / batal penjualan di SERVER ───────────────────────────────────────────────────────────

export type VoidOutcome =
  | { ok: true; restored: number }
  | { ok: false; reason: 'NO_STOCK_TRACE' | 'NOT_ON_SERVER' | 'OTHER'; message: string }

/**
 * Void lewat fungsi DB void_sale_with_stock: membalik PERSIS baris 'out' yang tercatat untuk nota
 * ini, mengunci status (dua perangkat tak bisa void dua kali) dan idempoten. Dulu void menebak dari
 * nama item & menulis status sekali jalan — nota bisa di-void 2× dan stok "kembali" walau penjualan
 * offline-nya tak pernah memotong stok (+3 pcs fantom, 12 Sep).
 * force=true: void walau nota tak punya jejak stok keluar (stok TIDAK dikembalikan).
 */
export async function voidSaleOnServer(txnId: string, actor?: string, force = false): Promise<VoidOutcome> {
  if (!isSupabaseConfigured()) return { ok: true, restored: 0 }
  for (let t = 0; t < 3; t++) {
    try {
      const { data, error } = await getSupabaseBrowser().rpc('void_sale_with_stock', {
        p_txn_id: txnId, p_actor: actor ?? null, p_force: force,
      })
      if (!error) {
        const rows = (Array.isArray(data) ? data : []) as StockResult[]
        return { ok: true, restored: rows.filter((r) => r.applied).length }
      }
      const code = (error as { code?: string }).code ?? ''
      if (/STOK_BELUM_TERCATAT/.test(error.message)) return { ok: false, reason: 'NO_STOCK_TRACE', message: error.message }
      if (code === 'P0002') return { ok: false, reason: 'NOT_ON_SERVER', message: error.message }
      if (isPermanent(code)) return { ok: false, reason: 'OTHER', message: error.message }
    } catch (e) {
      if (t === 2) return { ok: false, reason: 'OTHER', message: e instanceof Error ? e.message : String(e) }
    }
    await new Promise((r) => setTimeout(r, 700 * (t + 1))) // idempoten → aman diulang
  }
  return { ok: false, reason: 'OTHER', message: 'Koneksi bermasalah' }
}

// Tab lain di perangkat yang sama menguras/menambah antrean → perbarui lencana & angka di tab ini.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (ev) => {
    if (ev.key && (ev.key.startsWith(OUTBOX_PREFIX) || ev.key === DEAD_KEY)) notifyQueue()
  })
}

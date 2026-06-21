import { create } from 'zustand'
import type { Transaction, TransactionItem, PaymentMethod, TransactionStatus, User, Employee } from '@/types'
import { mockTransactions } from '@/lib/mock-data'
import { getSupabaseBrowser } from '@/lib/supabase/client'
import { isSupabaseConfigured, DEFAULT_TENANT_ID } from '@/lib/supabase/config'
import { updateRow } from '@/lib/supabase/repo'
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
        status: txn.status,
        notes: txn.notes ?? null,
        source: txn.source ?? 'pos',
        shipping_cost: txn.shipping_cost ?? 0,
      })
      .select('id')
      .single()
    if (error || !data) {
      console.warn('[akapack] gagal simpan transaksi:', error?.message)
      return null
    }
    const txnId = (data as { id: string }).id
    if (txn.items.length) {
      const rows = txn.items.map((it) => ({
        transaction_id: txnId,
        product_id: isUuid(it.product_id) ? it.product_id : null,
        product_name: it.product_name,
        product_price: it.product_price,
        quantity: it.quantity,
        discount: it.discount,
        subtotal: it.subtotal,
      }))
      const { error: itemsErr } = await sb.from('transaction_items').insert(rows)
      if (itemsErr) console.warn('[akapack] gagal simpan item transaksi:', itemsErr.message)
    }
    return txnId
  } catch (e) {
    console.warn('[akapack] error simpan transaksi:', e)
    return null
  }
}

interface TransactionStore {
  transactions: Transaction[]
  /** Transaksi terakhir yang sukses — dipakai untuk preview struk */
  lastTransaction: Transaction | null
  loaded: boolean
  fetch: () => Promise<void>
  addTransaction: (txn: Transaction) => void
  voidTransaction: (id: string) => void
  setStatus: (id: string, status: TransactionStatus) => void
}

export const useTransactionStore = create<TransactionStore>()((set) => ({
  transactions: isSupabaseConfigured() ? [] : mockTransactions,
  lastTransaction: null,
  loaded: false,

  fetch: async () => {
    if (!isSupabaseConfigured()) {
      set({ loaded: true })
      return
    }
    try {
      const sb = getSupabaseBrowser()
      // Paginasi: PostgREST membatasi 1000 baris/permintaan — tanpa ini transaksi lama (>1000) hilang.
      const rows: TxnRow[] = []
      for (let from = 0; ; from += 1000) {
        const { data, error } = await sb
          .from('transactions')
          .select('*, transaction_items(*)')
          .order('created_at', { ascending: false })
          .range(from, from + 999)
        if (error) { if (from === 0) { set({ loaded: true }); return } break }
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
          status: r.status,
          notes: r.notes ?? undefined,
          source: (r.source as 'pos' | 'online') ?? undefined,
          shipping_cost: r.shipping_cost ?? undefined,
          created_at: r.created_at,
        }
      })
      set({ transactions: mapped, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },

  addTransaction: (txn) => {
    set((s) => ({ transactions: [txn, ...s.transactions], lastTransaction: txn }))
    void persistTransaction(txn).then((newId) => {
      if (!newId) return
      set((s) => ({
        transactions: s.transactions.map((t) => (t.id === txn.id ? { ...t, id: newId } : t)),
        lastTransaction: s.lastTransaction && s.lastTransaction.id === txn.id
          ? { ...s.lastTransaction, id: newId }
          : s.lastTransaction,
      }))
    })
  },

  voidTransaction: (id) => {
    set((s) => ({
      transactions: s.transactions.map((t) => (t.id === id ? { ...t, status: 'void' } : t)),
    }))
    if (isUuid(id)) void updateRow('transactions', id, { status: 'void' })
  },

  setStatus: (id, status) => {
    set((s) => ({
      transactions: s.transactions.map((t) => (t.id === id ? { ...t, status } : t)),
    }))
    if (isUuid(id)) void updateRow('transactions', id, { status })
  },
}))

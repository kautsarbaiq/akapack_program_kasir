import { create } from 'zustand'
import { toast } from 'sonner'
import type { SalesOrder, SalesOrderStatus } from '@/types'
import { getSupabaseBrowser } from '@/lib/supabase/client'
import { isSupabaseConfigured, DEFAULT_TENANT_ID } from '@/lib/supabase/config'
import { updateRow, deleteRow } from '@/lib/supabase/repo'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (s?: string | null): s is string => !!s && UUID_RE.test(s)

interface SalesOrderItemRow {
  id: string; sales_order_id: string; product_id: string | null
  product_name: string; qty: number; price: number; subtotal: number
}
interface SalesOrderRow {
  id: string; number: string; outlet_id: string | null
  customer_name: string; customer_address: string | null; customer_phone: string | null
  order_date: string; sales_name: string | null; sales_id: string | null
  sales_phone?: string | null; source_phone?: string | null; created_by_name?: string | null
  bank_name: string | null; bank_ref: string | null
  shipping_cost: number; subtotal: number; total: number
  status: SalesOrderStatus; notes: string | null; created_at: string
  sales_order_items: SalesOrderItemRow[] | null
}

async function persistSalesOrder(doc: SalesOrder): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  try {
    const sb = getSupabaseBrowser()
    const base = {
      tenant_id: DEFAULT_TENANT_ID,
      number: doc.number,
      outlet_id: isUuid(doc.outlet_id) ? doc.outlet_id : null,
      customer_name: doc.customer_name,
      customer_address: doc.customer_address ?? null,
      customer_phone: doc.customer_phone ?? null,
      order_date: doc.order_date,
      sales_name: doc.sales_name ?? null,
      sales_id: isUuid(doc.sales_id) ? doc.sales_id : null,
      bank_name: doc.bank_name ?? null,
      bank_ref: doc.bank_ref ?? null,
      shipping_cost: doc.shipping_cost,
      subtotal: doc.subtotal,
      total: doc.total,
      status: doc.status,
      notes: doc.notes ?? null,
    }
    const full = { ...base, sales_phone: doc.sales_phone ?? null, source_phone: doc.source_phone ?? null, created_by_name: doc.created_by_name ?? null }
    let { data, error } = await sb.from('sales_orders').insert(full).select('id').single()
    // Fallback HANYA untuk error "kolom tidak ada" (PGRST204/schema cache) — bukan constraint lain
    // yang kebetulan menyebut nama kolom (jangan buang source_phone/created_by_name diam-diam).
    const colMissing = error && ((error as { code?: string }).code === 'PGRST204' || /schema cache/i.test(error.message || ''))
    if (colMissing) {
      ({ data, error } = await sb.from('sales_orders').insert(base).select('id').single())
    }
    if (error || !data) { console.warn('[akapack] gagal simpan surat pesanan:', error?.message); return null }
    const docId = (data as { id: string }).id
    if (doc.items.length) {
      const rows = doc.items.map((it) => ({
        sales_order_id: docId,
        product_id: isUuid(it.product_id) ? it.product_id : null,
        product_name: it.product_name, qty: it.qty, price: it.price, subtotal: it.subtotal,
      }))
      const { error: itErr } = await sb.from('sales_order_items').insert(rows)
      if (itErr) console.warn('[akapack] gagal simpan item surat pesanan:', itErr.message)
    }
    return docId
  } catch (e) { console.warn('[akapack] error simpan surat pesanan:', e); return null }
}

interface SalesOrderStore {
  salesOrders: SalesOrder[]
  loaded: boolean
  fetch: () => Promise<void>
  addSalesOrder: (doc: SalesOrder) => void
  setStatus: (id: string, status: SalesOrderStatus) => void
  deleteSalesOrder: (id: string) => void
}

export const useSalesOrderStore = create<SalesOrderStore>()((set) => ({
  salesOrders: [],
  loaded: false,

  fetch: async () => {
    if (!isSupabaseConfigured()) { set({ loaded: true }); return }
    try {
      const sb = getSupabaseBrowser()
      // Paginasi (hindari batas 1000 baris PostgREST).
      const data: SalesOrderRow[] = []
      for (let from = 0; ; from += 1000) {
        const { data: page, error } = await sb
          .from('sales_orders').select('*, sales_order_items(*)')
          .order('order_date', { ascending: false }).order('id', { ascending: true }).range(from, from + 999)
        if (error) { if (from === 0) { set({ loaded: true }); return } break }
        const rows = (page ?? []) as unknown as SalesOrderRow[]
        data.push(...rows)
        if (rows.length < 1000) break
      }
      const mapped: SalesOrder[] = data.map((r) => ({
        id: r.id, number: r.number, outlet_id: r.outlet_id ?? '',
        customer_name: r.customer_name, customer_address: r.customer_address ?? undefined, customer_phone: r.customer_phone ?? undefined,
        order_date: r.order_date, sales_name: r.sales_name ?? undefined, sales_id: r.sales_id ?? undefined,
        sales_phone: r.sales_phone ?? undefined, source_phone: r.source_phone ?? undefined, created_by_name: r.created_by_name ?? undefined,
        bank_name: r.bank_name ?? undefined, bank_ref: r.bank_ref ?? undefined,
        shipping_cost: r.shipping_cost, subtotal: r.subtotal, total: r.total,
        status: r.status, notes: r.notes ?? undefined, created_at: r.created_at,
        items: (r.sales_order_items ?? []).map((it) => ({
          id: it.id, sales_order_id: it.sales_order_id, product_id: it.product_id ?? '',
          product_name: it.product_name, qty: it.qty, price: it.price, subtotal: it.subtotal,
        })),
      }))
      set({ salesOrders: mapped, loaded: true })
    } catch { set({ loaded: true }) }
  },

  addSalesOrder: (doc) => {
    set((s) => ({ salesOrders: [doc, ...s.salesOrders] }))
    void persistSalesOrder(doc).then((newId) => {
      if (!newId) {
        // Gagal simpan (mis. RLS masih nyala / koneksi) — jangan diam-diam: kasih tahu user.
        if (isSupabaseConfigured()) toast.error('Surat pesanan GAGAL tersimpan ke server. Belum bisa dikonfirmasi — hubungi admin (cek RLS/koneksi), lalu buat ulang.')
        return
      }
      // Tukar id sementara → UUID DB, termasuk FK sales_order_id di tiap item (biar konsisten).
      set((s) => ({ salesOrders: s.salesOrders.map((d) => (d.id === doc.id ? { ...d, id: newId, items: d.items.map((it) => ({ ...it, sales_order_id: newId })) } : d)) }))
    })
  },

  setStatus: (id, status) => {
    set((s) => ({ salesOrders: s.salesOrders.map((d) => (d.id === id ? { ...d, status } : d)) }))
    if (isUuid(id)) void updateRow('sales_orders', id, { status })
  },

  deleteSalesOrder: (id) => {
    set((s) => ({ salesOrders: s.salesOrders.filter((d) => d.id !== id) }))
    if (isUuid(id)) void deleteRow('sales_orders', id)
  },
}))

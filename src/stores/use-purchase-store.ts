import { create } from 'zustand'
import type { PurchaseOrder, PurchaseItem, PurchaseStatus, PurchasePayment } from '@/types'
import { getSupabaseBrowser } from '@/lib/supabase/client'
import { isSupabaseConfigured, DEFAULT_TENANT_ID } from '@/lib/supabase/config'
import { updateRow, deleteRow } from '@/lib/supabase/repo'
import { useSupplierStore } from './use-supplier-store'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (s?: string | null): s is string => !!s && UUID_RE.test(s)

interface PurchaseItemRow {
  id: string
  purchase_id: string
  product_id: string | null
  product_name: string
  qty: number
  cost: number
  subtotal: number
}

interface PurchaseRow {
  id: string
  number: string
  outlet_id: string | null
  supplier_id: string | null
  total: number
  status: PurchaseStatus
  payment: PurchasePayment
  paid: boolean | null
  paid_at: string | null
  notes: string | null
  received_from: string | null
  received_by: string | null
  date: string
  received_at: string | null
  created_at: string
  purchase_order_items: PurchaseItemRow[] | null
}

async function persistPurchase(po: PurchaseOrder): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  try {
    const sb = getSupabaseBrowser()
    const base = {
      tenant_id: DEFAULT_TENANT_ID,
      number: po.number,
      supplier_id: isUuid(po.supplier_id) ? po.supplier_id : null,
      total: po.total,
      status: po.status,
      payment: po.payment,
      paid: po.paid,
      paid_at: po.paid_at ?? null,
      notes: po.notes ?? null,
      received_from: po.received_from ?? null,
      received_by: po.received_by ?? null,
      date: po.date,
      received_at: po.received_at ?? null,
    }
    const payload = isUuid(po.outlet_id) ? { ...base, outlet_id: po.outlet_id } : base
    let { data, error } = await sb.from('purchase_orders').insert(payload).select('id').single()
    // Fallback: kalau kolom outlet_id belum dibuat (migrasi belum dijalankan), simpan tanpa kolom itu
    // supaya dokumen tetap tersimpan. Per-cabang penuh aktif setelah migrasi dijalankan.
    if (error && payload !== base && /outlet_id/i.test(error.message || '')) {
      ({ data, error } = await sb.from('purchase_orders').insert(base).select('id').single())
    }
    if (error || !data) {
      console.warn('[akapack] gagal simpan pembelian:', error?.message)
      return null
    }
    const poId = (data as { id: string }).id
    if (po.items.length) {
      const rows = po.items.map((it) => ({
        purchase_id: poId,
        product_id: isUuid(it.product_id) ? it.product_id : null,
        product_name: it.product_name,
        qty: it.qty,
        cost: it.cost,
        subtotal: it.subtotal,
      }))
      const { error: itErr } = await sb.from('purchase_order_items').insert(rows)
      if (itErr) console.warn('[akapack] gagal simpan item pembelian:', itErr.message)
    }
    return poId
  } catch (e) {
    console.warn('[akapack] error simpan pembelian:', e)
    return null
  }
}

interface PurchaseStore {
  purchases: PurchaseOrder[]
  loaded: boolean
  fetch: () => Promise<void>
  addPurchase: (po: PurchaseOrder) => void
  setStatus: (id: string, status: PurchaseStatus, receivedAt?: string) => void
  setPaid: (id: string, paid: boolean, paidAt?: string) => void
  deletePurchase: (id: string) => void
}

export const usePurchaseStore = create<PurchaseStore>()((set) => ({
  purchases: [],
  loaded: false,

  fetch: async () => {
    if (!isSupabaseConfigured()) {
      set({ loaded: true })
      return
    }
    try {
      const sb = getSupabaseBrowser()
      // Paginasi (hindari batas 1000 baris PostgREST).
      const data: PurchaseRow[] = []
      for (let from = 0; ; from += 1000) {
        const { data: page, error } = await sb
          .from('purchase_orders')
          .select('*, purchase_order_items(*)')
          .order('date', { ascending: false })
          .range(from, from + 999)
        if (error) { if (from === 0) { set({ loaded: true }); return } break }
        const rows = (page ?? []) as unknown as PurchaseRow[]
        data.push(...rows)
        if (rows.length < 1000) break
      }
      const suppliers = useSupplierStore.getState().suppliers
      const mapped: PurchaseOrder[] = (data as unknown as PurchaseRow[]).map((r) => {
        const items: PurchaseItem[] = (r.purchase_order_items ?? []).map((it) => ({
          id: it.id,
          purchase_id: it.purchase_id,
          product_id: it.product_id ?? '',
          product_name: it.product_name,
          qty: it.qty,
          cost: it.cost,
          subtotal: it.subtotal,
        }))
        return {
          id: r.id,
          number: r.number,
          outlet_id: r.outlet_id ?? undefined,
          supplier_id: r.supplier_id ?? undefined,
          supplier: suppliers.find((s) => s.id === r.supplier_id),
          items,
          total: r.total,
          status: r.status,
          payment: r.payment,
          paid: r.paid ?? false,
          paid_at: r.paid_at ?? undefined,
          notes: r.notes ?? undefined,
          received_from: r.received_from ?? undefined,
          received_by: r.received_by ?? undefined,
          date: r.date,
          received_at: r.received_at ?? undefined,
          created_at: r.created_at,
        }
      })
      set({ purchases: mapped, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },

  addPurchase: (po) => {
    set((s) => ({ purchases: [po, ...s.purchases] }))
    void persistPurchase(po).then((newId) => {
      if (!newId) return
      set((s) => ({ purchases: s.purchases.map((p) => (p.id === po.id ? { ...p, id: newId } : p)) }))
    })
  },

  setStatus: (id, status, receivedAt) => {
    set((s) => ({ purchases: s.purchases.map((p) => (p.id === id ? { ...p, status, received_at: receivedAt ?? p.received_at } : p)) }))
    if (isUuid(id)) void updateRow('purchase_orders', id, { status, received_at: receivedAt ?? null })
  },

  setPaid: (id, paid, paidAt) => {
    const pa = paid ? (paidAt ?? new Date().toISOString()) : undefined
    set((s) => ({ purchases: s.purchases.map((p) => (p.id === id ? { ...p, paid, paid_at: pa } : p)) }))
    if (isUuid(id)) void updateRow('purchase_orders', id, { paid, paid_at: pa ?? null })
  },

  deletePurchase: (id) => {
    set((s) => ({ purchases: s.purchases.filter((p) => p.id !== id) }))
    if (isUuid(id)) void deleteRow('purchase_orders', id)
  },
}))

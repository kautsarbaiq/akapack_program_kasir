import { create } from 'zustand'
import type { StockOut, StockOutItem, StockOutStatus } from '@/types'
import { getSupabaseBrowser } from '@/lib/supabase/client'
import { isSupabaseConfigured, DEFAULT_TENANT_ID } from '@/lib/supabase/config'
import { updateRow, deleteRow } from '@/lib/supabase/repo'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (s?: string | null): s is string => !!s && UUID_RE.test(s)

interface StockOutItemRow {
  id: string
  stock_out_id: string
  product_id: string | null
  product_name: string
  qty: number
  cost: number
  subtotal: number
}

interface StockOutRow {
  id: string
  number: string
  outlet_id: string | null
  reason: StockOut['reason']
  total: number
  total_qty: number
  status: StockOutStatus
  notes: string | null
  date: string
  posted_at: string | null
  created_at: string
  stock_out_items: StockOutItemRow[] | null
}

async function persistStockOut(doc: StockOut): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  try {
    const sb = getSupabaseBrowser()
    const { data, error } = await sb
      .from('stock_outs')
      .insert({
        tenant_id: DEFAULT_TENANT_ID,
        number: doc.number,
        outlet_id: isUuid(doc.outlet_id) ? doc.outlet_id : null,
        reason: doc.reason,
        total: doc.total,
        total_qty: doc.total_qty,
        status: doc.status,
        notes: doc.notes ?? null,
        date: doc.date,
        posted_at: doc.posted_at ?? null,
      })
      .select('id')
      .single()
    if (error || !data) {
      console.warn('[akapack] gagal simpan stok keluar:', error?.message)
      return null
    }
    const docId = (data as { id: string }).id
    if (doc.items.length) {
      const rows = doc.items.map((it) => ({
        stock_out_id: docId,
        product_id: isUuid(it.product_id) ? it.product_id : null,
        product_name: it.product_name,
        qty: it.qty,
        cost: it.cost,
        subtotal: it.subtotal,
      }))
      const { error: itErr } = await sb.from('stock_out_items').insert(rows)
      if (itErr) console.warn('[akapack] gagal simpan item stok keluar:', itErr.message)
    }
    return docId
  } catch (e) {
    console.warn('[akapack] error simpan stok keluar:', e)
    return null
  }
}

interface StockOutStore {
  stockOuts: StockOut[]
  loaded: boolean
  /** Muat sekali saat halaman pemakainya dibuka (lazy — hemat bandwidth saat boot). */
  ensure: () => void
  fetch: () => Promise<void>
  addStockOut: (doc: StockOut) => void
  setStatus: (id: string, status: StockOutStatus, postedAt?: string) => void
  deleteStockOut: (id: string) => void
}

let __fetching = false // anti dobel-fetch saat 2 halaman ensure bersamaan (StrictMode/navigasi cepat)
export const useStockOutStore = create<StockOutStore>()((set, get) => ({
  stockOuts: [],
  loaded: false,

  ensure: () => { if (!get().loaded && !__fetching) { __fetching = true; void get().fetch().finally(() => { __fetching = false }) } },

  fetch: async () => {
    if (!isSupabaseConfigured()) {
      set({ loaded: true })
      return
    }
    try {
      const sb = getSupabaseBrowser()
      // Paginasi (hindari batas 1000 baris PostgREST).
      const data: StockOutRow[] = []
      for (let from = 0; ; from += 1000) {
        const { data: page, error } = await sb
          .from('stock_outs')
          .select('*, stock_out_items(*)')
          .order('date', { ascending: false }).order('id', { ascending: true })
          .range(from, from + 999)
        if (error) { if (from === 0) { set({ loaded: true }); return } break }
        const rows = (page ?? []) as unknown as StockOutRow[]
        data.push(...rows)
        if (rows.length < 1000) break
      }
      const mapped: StockOut[] = (data as unknown as StockOutRow[]).map((r) => {
        const items: StockOutItem[] = (r.stock_out_items ?? []).map((it) => ({
          id: it.id,
          stock_out_id: it.stock_out_id,
          product_id: it.product_id ?? '',
          product_name: it.product_name,
          qty: it.qty,
          cost: it.cost,
          subtotal: it.subtotal,
        }))
        return {
          id: r.id,
          number: r.number,
          outlet_id: r.outlet_id ?? '',
          reason: r.reason,
          items,
          total: r.total,
          total_qty: r.total_qty,
          status: r.status,
          notes: r.notes ?? undefined,
          date: r.date,
          posted_at: r.posted_at ?? undefined,
          created_at: r.created_at,
        }
      })
      set({ stockOuts: mapped, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },

  addStockOut: (doc) => {
    set((s) => ({ stockOuts: [doc, ...s.stockOuts] }))
    void persistStockOut(doc).then((newId) => {
      if (!newId) return
      set((s) => ({ stockOuts: s.stockOuts.map((d) => (d.id === doc.id ? { ...d, id: newId } : d)) }))
    })
  },

  setStatus: (id, status, postedAt) => {
    set((s) => ({ stockOuts: s.stockOuts.map((d) => (d.id === id ? { ...d, status, posted_at: postedAt ?? d.posted_at } : d)) }))
    if (isUuid(id)) void updateRow('stock_outs', id, { status, posted_at: postedAt ?? null })
  },

  deleteStockOut: (id) => {
    set((s) => ({ stockOuts: s.stockOuts.filter((d) => d.id !== id) }))
    if (isUuid(id)) void deleteRow('stock_outs', id)
  },
}))

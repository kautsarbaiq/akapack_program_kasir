import { create } from 'zustand'
import { toast } from 'sonner'
import type { Quotation, QuotationStatus } from '@/types'
import { getSupabaseBrowser } from '@/lib/supabase/client'
import { isSupabaseConfigured, DEFAULT_TENANT_ID } from '@/lib/supabase/config'
import { updateRow, deleteRow } from '@/lib/supabase/repo'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (s?: string | null): s is string => !!s && UUID_RE.test(s)

interface QuotationItemRow {
  id: string; quotation_id: string; product_id: string | null
  description: string; unit_price: number; qty: number; total: number
}
interface QuotationRow {
  id: string; number: string; outlet_id: string | null
  customer_name: string; customer_address: string | null
  quote_date: string; total: number
  terms: string | null; bank_info: string | null; created_by_name: string | null
  status: QuotationStatus; created_at: string
  quotation_items: QuotationItemRow[] | null
}

async function persistQuotation(doc: Quotation): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  try {
    const sb = getSupabaseBrowser()
    const { data, error } = await sb.from('quotations').insert({
      tenant_id: DEFAULT_TENANT_ID,
      number: doc.number,
      outlet_id: isUuid(doc.outlet_id) ? doc.outlet_id : null,
      customer_name: doc.customer_name,
      customer_address: doc.customer_address ?? null,
      quote_date: doc.quote_date,
      total: doc.total,
      terms: doc.terms ?? null,
      bank_info: doc.bank_info ?? null,
      created_by_name: doc.created_by_name ?? null,
      status: doc.status,
    }).select('id').single()
    if (error || !data) { console.warn('[akapack] gagal simpan penawaran:', error?.message); return null }
    const docId = (data as { id: string }).id
    if (doc.items.length) {
      const rows = doc.items.map((it) => ({
        quotation_id: docId,
        product_id: isUuid(it.product_id) ? it.product_id : null,
        description: it.description, unit_price: it.unit_price, qty: it.qty, total: it.total,
      }))
      const { error: itErr } = await sb.from('quotation_items').insert(rows)
      if (itErr) console.warn('[akapack] gagal simpan item penawaran:', itErr.message)
    }
    return docId
  } catch (e) { console.warn('[akapack] error simpan penawaran:', e); return null }
}

interface QuotationStore {
  quotations: Quotation[]
  loaded: boolean
  /** Muat sekali saat halaman pemakainya dibuka (lazy — hemat bandwidth saat boot). */
  ensure: () => void
  fetch: () => Promise<void>
  addQuotation: (doc: Quotation) => void
  setStatus: (id: string, status: QuotationStatus) => void
  deleteQuotation: (id: string) => void
}

let __fetching = false // anti dobel-fetch saat 2 halaman ensure bersamaan (StrictMode/navigasi cepat)
export const useQuotationStore = create<QuotationStore>()((set, get) => ({
  quotations: [],
  loaded: false,

  ensure: () => { if (!get().loaded && !__fetching) { __fetching = true; void get().fetch().finally(() => { __fetching = false }) } },

  fetch: async () => {
    if (!isSupabaseConfigured()) { set({ loaded: true }); return }
    try {
      const sb = getSupabaseBrowser()
      // Paginasi (hindari batas 1000 baris PostgREST) + tie-break id agar deterministik.
      const data: QuotationRow[] = []
      for (let from = 0; ; from += 1000) {
        const { data: page, error } = await sb
          .from('quotations').select('*, quotation_items(*)')
          .order('quote_date', { ascending: false }).order('id', { ascending: true })
          .range(from, from + 999)
        if (error) { if (from === 0) { set({ loaded: true }); return } break }
        const rows = (page ?? []) as unknown as QuotationRow[]
        data.push(...rows)
        if (rows.length < 1000) break
      }
      const mapped: Quotation[] = data.map((r) => ({
        id: r.id, number: r.number, outlet_id: r.outlet_id ?? '',
        customer_name: r.customer_name, customer_address: r.customer_address ?? undefined,
        quote_date: r.quote_date, total: r.total,
        terms: r.terms ?? undefined, bank_info: r.bank_info ?? undefined, created_by_name: r.created_by_name ?? undefined,
        status: r.status, created_at: r.created_at,
        items: (r.quotation_items ?? []).map((it) => ({
          id: it.id, quotation_id: it.quotation_id, product_id: it.product_id ?? '',
          description: it.description, unit_price: it.unit_price, qty: it.qty, total: it.total,
        })),
      }))
      set({ quotations: mapped, loaded: true })
    } catch { set({ loaded: true }) }
  },

  addQuotation: (doc) => {
    set((s) => ({ quotations: [doc, ...s.quotations] }))
    void persistQuotation(doc).then((newId) => {
      if (!newId) {
        if (isSupabaseConfigured()) toast.error('Penawaran GAGAL tersimpan ke server. Pastikan migrasi quotations sudah dijalankan, lalu buat ulang.')
        return
      }
      set((s) => ({ quotations: s.quotations.map((d) => (d.id === doc.id ? { ...d, id: newId, items: d.items.map((it) => ({ ...it, quotation_id: newId })) } : d)) }))
    })
  },

  setStatus: (id, status) => {
    set((s) => ({ quotations: s.quotations.map((d) => (d.id === id ? { ...d, status } : d)) }))
    if (isUuid(id)) void updateRow('quotations', id, { status })
  },

  deleteQuotation: (id) => {
    set((s) => ({ quotations: s.quotations.filter((d) => d.id !== id) }))
    if (isUuid(id)) void deleteRow('quotations', id)
  },
}))

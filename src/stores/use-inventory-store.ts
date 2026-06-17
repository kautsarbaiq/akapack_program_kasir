import { create } from 'zustand'
import { mockProducts } from '@/lib/mock-data'
import { generateId } from '@/lib/utils'
import { DEFAULT_TENANT_ID, DEFAULT_OUTLET_ID, isSupabaseConfigured } from '@/lib/supabase/config'
import { getSupabaseBrowser } from '@/lib/supabase/client'
import { fetchAll, insertRow, updateRow } from '@/lib/supabase/repo'

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (s?: string | null): s is string => !!s && UUID_RE.test(s)

export interface InventoryRow {
  id: string
  outlet_id: string
  product_id: string
  variant_id?: string
  stock: number
  min_stock: number
}

interface InventoryRowDB {
  id: string
  outlet_id: string
  product_id: string
  variant_id: string | null
  stock: number | null
  min_stock: number | null
}

// Seed dari stok mock ke outlet Pusat (mock mode). Di DB mode digantikan fetch().
const seedRows: InventoryRow[] = mockProducts.map((p) => ({
  id: `inv-${p.id}`,
  outlet_id: DEFAULT_OUTLET_ID,
  product_id: p.id,
  stock: p.stock,
  min_stock: p.min_stock,
}))

const matches = (r: InventoryRow, outletId: string, productId: string, variantId?: string) =>
  r.outlet_id === outletId && r.product_id === productId && (variantId ? r.variant_id === variantId : !r.variant_id)

interface InventoryStore {
  items: InventoryRow[]
  loaded: boolean
  fetch: () => Promise<void>
  /** Stok di outlet tsb. null = inventory belum dikelola (kosong total) → pemanggil pakai fallback lama. */
  stockAt: (outletId: string, productId: string, variantId?: string) => number | null
  minStockAt: (outletId: string, productId: string, variantId?: string) => number | null
  applyDelta: (outletId: string, productId: string, variantId: string | undefined, delta: number) => { before: number; after: number }
  setStockAt: (outletId: string, productId: string, variantId: string | undefined, value: number) => { before: number; after: number }
  transfer: (fromOutlet: string, toOutlet: string, productId: string, variantId: string | undefined, qty: number) => void
  /** Saat produk baru tersimpan (id sementara → uuid), pindahkan & persist baris inventory-nya. */
  remapProduct: (oldProductId: string, newProductId: string) => void
  /** Saat varian baru tersimpan (id sementara → uuid), pindahkan & persist baris inventory varian. */
  remapVariant: (oldVariantId: string, newVariantId: string) => void
  /** Hapus baris inventory milik produk (saat produk dihapus). */
  removeProduct: (productId: string) => void
  /** Hapus baris inventory milik outlet (saat outlet dihapus). */
  removeByOutlet: (outletId: string) => void
  /** Kosongkan semua baris inventory di memori (saat hapus semua produk; DB ikut via cascade FK). */
  clearAll: () => void
  /** Set stok massal (absolut) untuk banyak produk di satu outlet — 1x update memori + batch ke DB. Mengembalikan jumlah baris yang GAGAL ke DB. */
  bulkUpsert: (outletId: string, entries: { productId: string; stock: number }[]) => Promise<number>
}

// Baris sementara yang insert-nya sedang berjalan — cegah double-insert (race) sebelum id ditukar.
const inserting = new Set<string>()

function persistRow(row: InventoryRow) {
  if (isUuid(row.id)) {
    void updateRow('inventory', row.id, { stock: row.stock, min_stock: row.min_stock })
    return row.id
  }
  // Baris baru → insert; FK butuh uuid. Jangan insert baris VARIAN sebelum variant_id jadi uuid
  // (cegah baris varian salah jadi level-produk). Mock mode: config-gated → no-op.
  if (isUuid(row.product_id) && (!row.variant_id || isUuid(row.variant_id))) {
    if (inserting.has(row.id)) return null // insert sudah jalan; nilai terkini di-flush saat resolve
    inserting.add(row.id)
    void insertRow<InventoryRowDB>('inventory', {
      tenant_id: DEFAULT_TENANT_ID,
      outlet_id: row.outlet_id,
      product_id: row.product_id,
      variant_id: row.variant_id ?? null,
      stock: row.stock,
      min_stock: row.min_stock,
    }).then((r) => {
      inserting.delete(row.id)
      if (!r) return
      useInventoryStore.setState((s) => ({ items: s.items.map((x) => (x.id === row.id ? { ...x, id: r.id } : x)) }))
      // Flush stok terkini bila berubah selama insert berjalan (mutasi di jendela race)
      const cur = useInventoryStore.getState().items.find((x) => x.id === r.id)
      if (cur && (cur.stock !== row.stock || cur.min_stock !== row.min_stock)) {
        void updateRow('inventory', r.id, { stock: cur.stock, min_stock: cur.min_stock })
      }
    })
  }
  return null
}

export const useInventoryStore = create<InventoryStore>()((set, get) => ({
  items: seedRows,
  loaded: false,

  fetch: async () => {
    const rows = await fetchAll<InventoryRowDB>('inventory', 'created_at', true)
    if (!rows) {
      set({ loaded: true }) // tabel belum ada → pertahankan seed mock (fallback)
      return
    }
    const mapped: InventoryRow[] = rows.map((r) => ({
      id: r.id,
      outlet_id: r.outlet_id,
      product_id: r.product_id,
      variant_id: r.variant_id ?? undefined,
      stock: r.stock ?? 0,
      min_stock: r.min_stock ?? 0,
    }))
    set({ items: mapped, loaded: true })
  },

  stockAt: (outletId, productId, variantId) => {
    const items = get().items
    if (items.length === 0) return null
    const row = items.find((r) => matches(r, outletId, productId, variantId))
    return row ? row.stock : 0
  },

  minStockAt: (outletId, productId, variantId) => {
    const items = get().items
    if (items.length === 0) return null
    const row = items.find((r) => matches(r, outletId, productId, variantId))
    return row ? row.min_stock : 0
  },

  applyDelta: (outletId, productId, variantId, delta) => {
    const items = get().items
    const row = items.find((r) => matches(r, outletId, productId, variantId))
    const before = row ? row.stock : 0
    const after = Math.max(0, before + delta)
    if (row) {
      const updated = { ...row, stock: after }
      set({ items: items.map((r) => (r === row ? updated : r)) })
      persistRow(updated)
    } else {
      const nr: InventoryRow = { id: generateId('inv'), outlet_id: outletId, product_id: productId, variant_id: variantId, stock: after, min_stock: 0 }
      set({ items: [...items, nr] })
      persistRow(nr)
    }
    return { before, after }
  },

  setStockAt: (outletId, productId, variantId, value) => {
    const items = get().items
    const row = items.find((r) => matches(r, outletId, productId, variantId))
    const before = row ? row.stock : 0
    const after = Math.max(0, value)
    if (row) {
      const updated = { ...row, stock: after }
      set({ items: items.map((r) => (r === row ? updated : r)) })
      persistRow(updated)
    } else {
      const nr: InventoryRow = { id: generateId('inv'), outlet_id: outletId, product_id: productId, variant_id: variantId, stock: after, min_stock: 0 }
      set({ items: [...items, nr] })
      persistRow(nr)
    }
    return { before, after }
  },

  transfer: (fromOutlet, toOutlet, productId, variantId, qty) => {
    get().applyDelta(fromOutlet, productId, variantId, -qty)
    get().applyDelta(toOutlet, productId, variantId, qty)
  },

  remapProduct: (oldId, newId) => {
    const items = get().items
    if (!items.some((r) => r.product_id === oldId)) return
    const next = items.map((r) => (r.product_id === oldId ? { ...r, product_id: newId } : r))
    set({ items: next })
    next.filter((r) => r.product_id === newId).forEach((r) => persistRow(r))
  },

  remapVariant: (oldId, newId) => {
    const items = get().items
    if (!items.some((r) => r.variant_id === oldId)) return
    const next = items.map((r) => (r.variant_id === oldId ? { ...r, variant_id: newId } : r))
    set({ items: next })
    next.filter((r) => r.variant_id === newId).forEach((r) => persistRow(r))
  },

  removeProduct: (productId) => set((s) => ({ items: s.items.filter((r) => r.product_id !== productId) })),

  removeByOutlet: (outletId) => set((s) => ({ items: s.items.filter((r) => r.outlet_id !== outletId) })),

  clearAll: () => set({ items: [] }),

  bulkUpsert: async (outletId, entries) => {
    const items = get().items
    const idxByKey = new Map<string, number>()
    items.forEach((r, i) => { if (!r.variant_id) idxByKey.set(`${r.outlet_id}|${r.product_id}`, i) })
    const next = items.slice()
    const updates: { id: string; stock: number; min_stock: number }[] = []
    const inserts: InventoryRow[] = []
    for (const e of entries) {
      const stock = Math.max(0, Math.round(e.stock))
      const k = `${outletId}|${e.productId}`
      const idx = idxByKey.get(k)
      if (idx !== undefined) {
        next[idx] = { ...next[idx], stock }
        if (isUuid(next[idx].id)) updates.push({ id: next[idx].id, stock, min_stock: next[idx].min_stock })
      } else {
        const nr: InventoryRow = { id: generateId('inv'), outlet_id: outletId, product_id: e.productId, stock, min_stock: 0 }
        next.push(nr); idxByKey.set(k, next.length - 1)
        if (isUuid(e.productId)) inserts.push(nr)
      }
    }
    set({ items: next })
    if (!isSupabaseConfigured()) return 0
    const sb = getSupabaseBrowser()
    let failed = 0
    for (const c of chunk(updates, 500)) {
      try {
        const { error } = await sb.from('inventory').upsert(c)
        if (error) { failed += c.length; console.warn('[akapack] bulk update inventory:', error.message) }
      } catch (e) { failed += c.length; console.warn('[akapack] bulk update inventory:', e) }
    }
    for (const c of chunk(inserts, 500)) {
      try {
        const rows = c.map((r) => ({ tenant_id: DEFAULT_TENANT_ID, outlet_id: r.outlet_id, product_id: r.product_id, variant_id: null, stock: r.stock, min_stock: r.min_stock }))
        const { data, error } = await sb.from('inventory').insert(rows).select('id, product_id')
        if (error || !data) { failed += c.length; if (error) console.warn('[akapack] bulk insert inventory:', error.message) }
        else {
          const idByProduct = new Map((data as { id: string; product_id: string }[]).map((d) => [d.product_id, d.id]))
          set((s) => ({ items: s.items.map((r) => (r.outlet_id === outletId && !r.variant_id && !isUuid(r.id) && idByProduct.has(r.product_id) ? { ...r, id: idByProduct.get(r.product_id) as string } : r)) }))
        }
      } catch (e) { failed += c.length; console.warn('[akapack] bulk insert inventory:', e) }
    }
    return failed
  },
}))

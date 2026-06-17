import { create } from 'zustand'
import type { Product, ProductUnit, PriceTier } from '@/types'
import type { ProductFormValues } from '@/lib/validations'
import { mockProducts } from '@/lib/mock-data'
import { generateId, getStockStatus } from '@/lib/utils'
import { DEFAULT_TENANT_ID, isSupabaseConfigured } from '@/lib/supabase/config'
import { getSupabaseBrowser } from '@/lib/supabase/client'
import { fetchAll, insertRow, updateRow, deleteRow } from '@/lib/supabase/repo'
import { useCategoryStore } from './use-category-store'

/** Input bulkAdd: form produk standar + opsi kaya dari import katalog (foto & harga online). */
export type BulkProductInput = ProductFormValues & { image_url?: string; price_online?: number }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const asUuidOrNull = (s?: string | null) => (s && UUID_RE.test(s) ? s : null)
const isUuid = (s?: string | null): s is string => !!s && UUID_RE.test(s)

export type ProductPatch = { id: string; price?: number; cost_price?: number; price_online?: number; image_url?: string; category_id?: string }

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}
import { useInventoryStore } from './use-inventory-store'
import { useActiveOutletStore } from './use-active-outlet-store'

interface ProductStore {
  products: Product[]
  loaded: boolean
  fetch: () => Promise<void>
  addProduct: (values: ProductFormValues, units?: ProductUnit[], priceTiers?: PriceTier[], priceOnline?: number) => Product
  /** Buat banyak produk sekaligus (import). 1x update memori + batch insert DB. Korelasi by SKU; kembalikan produk (urut input) + jumlah gagal. */
  bulkAdd: (rows: BulkProductInput[]) => Promise<{ products: Product[]; failed: number }>
  /** Perbarui sebagian field banyak produk (re-import katalog). Update memori 1x + batch DB. Kembalikan jumlah gagal. */
  bulkPatch: (patches: ProductPatch[]) => Promise<number>
  updateProduct: (id: string, values: ProductFormValues, units?: ProductUnit[], priceTiers?: PriceTier[], priceOnline?: number) => void
  deleteProduct: (id: string) => void
  /** Hapus SEMUA produk (katalog) — DB dulu, baru memori. Cascade: inventory, varian, pergerakan stok.
   *  Gagal bila ada produk dipakai di dokumen Pembelian/Stok Keluar (FK RESTRICT). Kembalikan status jujur. */
  deleteAllProducts: () => Promise<{ ok: boolean; error?: string }>
  /** Kurangi stok saat transaksi POS */
  decrementStock: (id: string, qty: number) => void
  /** Kembalikan stok (mis. pesanan online dibatalkan) */
  incrementStock: (id: string, qty: number) => void
  /** Set stok absolut (stok masuk / opname) */
  setStock: (id: string, newStock: number) => void
  /** Set harga modal (mis. moving-average saat terima pembelian) */
  setCostPrice: (id: string, newCost: number) => void
  /** Proyeksikan field `stock` produk dari inventory outlet tsb (dipanggil saat ganti outlet aktif) */
  projectStock: (outletId: string) => void
  /** Tandai produk punya varian */
  setHasVariants: (id: string, value: boolean) => void
  /** Set URL foto produk */
  setProductImage: (id: string, url: string) => void
  /** Ubah ketersediaan (aktif/nonaktif) produk */
  setActive: (id: string, value: boolean) => void
}

function resolveCategory(categoryId: string) {
  return useCategoryStore.getState().categories.find((c) => c.id === categoryId)
}

export const useProductStore = create<ProductStore>()((set) => ({
  products: isSupabaseConfigured() ? [] : mockProducts,
  loaded: false,

  fetch: async () => {
    const rows = await fetchAll<Product>('products', 'created_at', false)
    if (rows) {
      const withMeta = rows.map((p) => ({
        ...p,
        category: resolveCategory(p.category_id),
        stock_status: getStockStatus(p.stock, p.min_stock),
      }))
      set({ products: withMeta, loaded: true })
    } else {
      set({ loaded: true })
    }
  },

  addProduct: (values, units, priceTiers, priceOnline) => {
    const now = new Date().toISOString()
    const newProduct: Product = {
      id: generateId('prod'),
      outlet_id: 'outlet-1',
      category_id: values.category_id,
      category: resolveCategory(values.category_id),
      name: values.name,
      sku: values.sku,
      barcode: values.barcode || undefined,
      description: values.description || undefined,
      image_url: undefined,
      price: values.price,
      cost_price: values.cost_price,
      stock: values.stock,
      min_stock: values.min_stock,
      unit: values.unit,
      units: units ?? [],
      price_tiers: priceTiers ?? [],
      price_online: priceOnline ?? 0,
      is_active: values.is_active,
      stock_status: getStockStatus(values.stock, values.min_stock),
      created_at: now,
      updated_at: now,
    }
    set((s) => ({ products: [newProduct, ...s.products] }))
    // Stok awal masuk ke inventory outlet aktif (per-outlet)
    useInventoryStore.getState().setStockAt(useActiveOutletStore.getState().activeOutletId, newProduct.id, undefined, values.stock)
    void insertRow<Product>('products', {
      tenant_id: DEFAULT_TENANT_ID,
      category_id: values.category_id,
      name: values.name,
      sku: values.sku,
      barcode: values.barcode || null,
      description: values.description || null,
      price: values.price,
      cost_price: values.cost_price,
      stock: values.stock,
      min_stock: values.min_stock,
      unit: values.unit,
      units: units ?? [],
      price_tiers: priceTiers ?? [],
      price_online: priceOnline ?? 0,
      is_active: values.is_active,
    }).then((saved) => {
      if (saved) {
        useInventoryStore.getState().remapProduct(newProduct.id, saved.id)
        // Pertahankan stok terproyeksi outlet aktif (mutasi selama insert tidak ter-undo)
        const projected = useInventoryStore.getState().stockAt(useActiveOutletStore.getState().activeOutletId, saved.id) ?? saved.stock
        set((s) => ({
          products: s.products.map((p) => (p.id === newProduct.id
            ? { ...saved, stock: projected, category: resolveCategory(saved.category_id), stock_status: getStockStatus(projected, saved.min_stock) }
            : p)),
        }))
      }
    })
    return newProduct
  },

  bulkAdd: async (rows) => {
    const now = new Date().toISOString()
    const created: Product[] = rows.map((v) => ({
      id: generateId('prod'), outlet_id: 'outlet-1', category_id: v.category_id, category: resolveCategory(v.category_id),
      name: v.name, sku: v.sku, barcode: v.barcode || undefined, description: v.description || undefined, image_url: v.image_url || undefined,
      price: v.price, cost_price: v.cost_price, stock: v.stock, min_stock: v.min_stock, unit: v.unit,
      units: [], price_tiers: [], price_online: v.price_online ?? 0, is_active: v.is_active,
      stock_status: getStockStatus(v.stock, v.min_stock), created_at: now, updated_at: now,
    }))
    set((s) => ({ products: [...created, ...s.products] }))
    if (!isSupabaseConfigured()) return { products: created, failed: 0 }
    const sb = getSupabaseBrowser()
    const finals = created.slice()
    let offset = 0
    let failed = 0
    for (const c of chunk(created, 500)) {
      const payload = c.map((p) => ({
        tenant_id: DEFAULT_TENANT_ID, category_id: asUuidOrNull(p.category_id), name: p.name, sku: p.sku, barcode: p.barcode ?? null,
        description: p.description ?? null, image_url: p.image_url ?? null, price: p.price, cost_price: p.cost_price, stock: p.stock, min_stock: p.min_stock,
        unit: p.unit, units: [], price_tiers: [], price_online: p.price_online ?? 0, is_active: p.is_active,
      }))
      try {
        const { data, error } = await sb.from('products').insert(payload).select()
        if (error || !data) { failed += c.length; if (error) console.warn('[akapack] bulk add products:', error.message) }
        else {
          // Korelasi baris tersimpan ke input by SKU (jangan andalkan urutan Supabase)
          const bySku = new Map((data as Product[]).map((s) => [s.sku, s]))
          const remap = new Map<string, Product>()
          c.forEach((temp, i) => {
            const srow = bySku.get(temp.sku)
            if (srow) {
              const f = { ...srow, category: resolveCategory(srow.category_id), stock_status: getStockStatus(srow.stock, srow.min_stock) }
              finals[offset + i] = f
              remap.set(temp.id, f)
            } else { failed++ }
          })
          set((s) => ({ products: s.products.map((p) => remap.get(p.id) ?? p) }))
        }
      } catch (e) { failed += c.length; console.warn('[akapack] bulk add products:', e) }
      offset += c.length
    }
    return { products: finals, failed }
  },

  bulkPatch: async (patches) => {
    if (patches.length === 0) return 0
    const byId = new Map(patches.map((p) => [p.id, p]))
    set((s) => ({
      products: s.products.map((p) => {
        const patch = byId.get(p.id)
        if (!patch) return p
        const next = {
          ...p,
          price: patch.price ?? p.price,
          cost_price: patch.cost_price ?? p.cost_price,
          price_online: patch.price_online ?? p.price_online,
          image_url: patch.image_url ?? p.image_url,
          category_id: patch.category_id ?? p.category_id,
          updated_at: new Date().toISOString(),
        }
        return { ...next, category: resolveCategory(next.category_id) }
      }),
    }))
    if (!isSupabaseConfigured()) return 0
    const sb = getSupabaseBrowser()
    let failed = 0
    // Hanya produk yang sudah uuid yang bisa di-update ke DB
    const dbPatches = patches.filter((p) => isUuid(p.id))
    for (const grp of chunk(dbPatches, 25)) {
      const results = await Promise.all(grp.map(async (patch) => {
        const upd: Record<string, unknown> = {}
        if (patch.price !== undefined) upd.price = patch.price
        if (patch.cost_price !== undefined) upd.cost_price = patch.cost_price
        if (patch.price_online !== undefined) upd.price_online = patch.price_online
        if (patch.image_url !== undefined) upd.image_url = patch.image_url
        if (patch.category_id !== undefined) upd.category_id = asUuidOrNull(patch.category_id)
        if (Object.keys(upd).length === 0) return true
        const { error } = await sb.from('products').update(upd).eq('id', patch.id)
        if (error) { console.warn('[akapack] bulkPatch products:', error.message); return false }
        return true
      }))
      failed += results.filter((ok) => !ok).length
    }
    return failed
  },

  updateProduct: (id, values, units, priceTiers, priceOnline) => {
    set((s) => ({
      products: s.products.map((p) =>
        p.id === id
          ? {
              ...p,
              ...values,
              barcode: values.barcode || undefined,
              description: values.description || undefined,
              units: units ?? p.units ?? [],
              price_tiers: priceTiers ?? p.price_tiers ?? [],
              price_online: priceOnline ?? p.price_online ?? 0,
              category: resolveCategory(values.category_id),
              stock_status: getStockStatus(values.stock, values.min_stock),
              updated_at: new Date().toISOString(),
            }
          : p
      ),
    }))
    // Stok adalah sumber-kebenaran inventory (per outlet aktif), bukan kolom products
    useInventoryStore.getState().setStockAt(useActiveOutletStore.getState().activeOutletId, id, undefined, values.stock)
    void updateRow('products', id, {
      category_id: values.category_id,
      name: values.name,
      sku: values.sku,
      barcode: values.barcode || null,
      description: values.description || null,
      price: values.price,
      cost_price: values.cost_price,
      stock: values.stock,
      min_stock: values.min_stock,
      unit: values.unit,
      units: units ?? [],
      price_tiers: priceTiers ?? [],
      price_online: priceOnline ?? 0,
      is_active: values.is_active,
    })
  },

  deleteProduct: (id) => {
    set((s) => ({ products: s.products.filter((p) => p.id !== id) }))
    useInventoryStore.getState().removeProduct(id)
    void deleteRow('products', id)
  },

  deleteAllProducts: async () => {
    // DB dulu: kalau gagal (mis. produk dipakai di dokumen Pembelian/Stok Keluar),
    // memori TIDAK dikosongkan supaya tidak ada mismatch (data balik saat reload).
    if (isSupabaseConfigured()) {
      try {
        const sb = getSupabaseBrowser()
        const { error } = await sb.from('products').delete().eq('tenant_id', DEFAULT_TENANT_ID)
        if (error) {
          console.warn('[akapack] deleteAllProducts:', error.message)
          return { ok: false, error: error.message }
        }
      } catch (e) {
        console.warn('[akapack] deleteAllProducts:', e)
        return { ok: false, error: e instanceof Error ? e.message : 'Gagal hapus' }
      }
    }
    set({ products: [] })
    return { ok: true }
  },

  // Stok kini per-outlet: mutasi diterapkan ke inventory outlet AKTIF, lalu proyeksi field `stock`.
  decrementStock: (id, qty) => {
    const outlet = useActiveOutletStore.getState().activeOutletId
    const { after } = useInventoryStore.getState().applyDelta(outlet, id, undefined, -qty)
    set((s) => ({ products: s.products.map((p) => (p.id === id ? { ...p, stock: after, stock_status: getStockStatus(after, p.min_stock) } : p)) }))
  },

  incrementStock: (id, qty) => {
    const outlet = useActiveOutletStore.getState().activeOutletId
    const { after } = useInventoryStore.getState().applyDelta(outlet, id, undefined, qty)
    set((s) => ({ products: s.products.map((p) => (p.id === id ? { ...p, stock: after, stock_status: getStockStatus(after, p.min_stock) } : p)) }))
  },

  setStock: (id, newStock) => {
    const outlet = useActiveOutletStore.getState().activeOutletId
    const { after } = useInventoryStore.getState().setStockAt(outlet, id, undefined, newStock)
    set((s) => ({ products: s.products.map((p) => (p.id === id ? { ...p, stock: after, stock_status: getStockStatus(after, p.min_stock) } : p)) }))
  },

  projectStock: (outletId) => {
    const inv = useInventoryStore.getState()
    set((s) => ({
      products: s.products.map((p) => {
        const st = inv.stockAt(outletId, p.id)
        return st === null ? p : { ...p, stock: st, stock_status: getStockStatus(st, p.min_stock) }
      }),
    }))
  },

  setCostPrice: (id, newCost) => {
    set((s) => ({ products: s.products.map((p) => (p.id === id ? { ...p, cost_price: newCost } : p)) }))
    void updateRow('products', id, { cost_price: newCost })
  },

  setHasVariants: (id, value) => {
    set((s) => ({
      products: s.products.map((p) => (p.id === id ? { ...p, has_variants: value } : p)),
    }))
    void updateRow('products', id, { has_variants: value })
  },

  setProductImage: (id, url) => {
    set((s) => ({
      products: s.products.map((p) => (p.id === id ? { ...p, image_url: url } : p)),
    }))
    void updateRow('products', id, { image_url: url })
  },

  setActive: (id, value) => {
    set((s) => ({ products: s.products.map((p) => (p.id === id ? { ...p, is_active: value } : p)) }))
    void updateRow('products', id, { is_active: value })
  },
}))

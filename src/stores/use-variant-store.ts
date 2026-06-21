import { create } from 'zustand'
import type { ProductVariant } from '@/types'
import { generateId } from '@/lib/utils'
import { DEFAULT_TENANT_ID } from '@/lib/supabase/config'
import { fetchAll, insertRow, updateRow, deleteRow } from '@/lib/supabase/repo'
import { useInventoryStore } from './use-inventory-store'
import { useActiveOutletStore } from './use-active-outlet-store'

export interface VariantFormValues {
  name: string
  sku?: string
  price: number
  cost_price: number
  stock: number
}

interface VariantStore {
  variants: ProductVariant[]
  loaded: boolean
  fetch: () => Promise<void>
  byProduct: (productId: string) => ProductVariant[]
  addVariant: (productId: string, data: VariantFormValues) => ProductVariant
  updateVariant: (id: string, data: VariantFormValues) => void
  deleteVariant: (id: string) => void
  /** Kurangi stok varian saat transaksi POS */
  clearAll: () => void
  decrementVariantStock: (id: string, qty: number) => void
  /** Kembalikan stok varian (mis. pesanan online dibatalkan) */
  incrementVariantStock: (id: string, qty: number) => void
  /** Proyeksikan stok varian dari inventory outlet tsb (saat ganti outlet aktif) */
  projectVariantStock: (outletId: string) => void
}

export const useVariantStore = create<VariantStore>()((set, get) => ({
  variants: [],
  loaded: false,

  fetch: async () => {
    const rows = await fetchAll<ProductVariant>('product_variants', 'created_at', true)
    if (rows) set({ variants: rows, loaded: true })
    else set({ loaded: true })
  },

  byProduct: (productId) => get().variants.filter((v) => v.product_id === productId),

  addVariant: (productId, data) => {
    const v: ProductVariant = {
      id: generateId('var'),
      product_id: productId,
      name: data.name,
      sku: data.sku || undefined,
      price: data.price,
      cost_price: data.cost_price,
      stock: data.stock,
      is_active: true,
      created_at: new Date().toISOString(),
    }
    set((s) => ({ variants: [...s.variants, v] }))
    // Stok awal varian → inventory outlet aktif
    useInventoryStore.getState().setStockAt(useActiveOutletStore.getState().activeOutletId, productId, v.id, data.stock)
    void insertRow<ProductVariant>('product_variants', {
      tenant_id: DEFAULT_TENANT_ID,
      product_id: productId,
      name: data.name,
      sku: data.sku || null,
      price: data.price,
      cost_price: data.cost_price,
      stock: data.stock,
      is_active: true,
    }).then((saved) => {
      if (saved) {
        useInventoryStore.getState().remapVariant(v.id, saved.id)
        set((s) => ({ variants: s.variants.map((x) => (x.id === v.id ? saved : x)) }))
      }
    })
    return v
  },

  updateVariant: (id, data) => {
    set((s) => ({
      variants: s.variants.map((v) =>
        v.id === id ? { ...v, name: data.name, sku: data.sku || undefined, price: data.price, cost_price: data.cost_price, stock: data.stock } : v
      ),
    }))
    const pv = get().variants.find((x) => x.id === id)
    if (pv) {
      // Sama seperti produk: hanya tulis stok kalau benar-benar diubah, agar edit varian
      // tidak menimpa hasil Stok Masuk/Keluar.
      const outlet = useActiveOutletStore.getState().activeOutletId
      const invStore = useInventoryStore.getState()
      const liveStock = invStore.stockAt(outlet, pv.product_id, id)
      if (liveStock === null || data.stock !== liveStock) {
        invStore.setStockAt(outlet, pv.product_id, id, data.stock)
      }
    }
    void updateRow('product_variants', id, {
      name: data.name,
      sku: data.sku || null,
      price: data.price,
      cost_price: data.cost_price,
      stock: data.stock,
    })
  },

  deleteVariant: (id) => {
    set((s) => ({ variants: s.variants.filter((v) => v.id !== id) }))
    void deleteRow('product_variants', id)
  },

  clearAll: () => set({ variants: [] }),

  // Stok varian per-outlet: lewat inventory (outlet aktif), lalu proyeksi field `stock`.
  decrementVariantStock: (id, qty) => {
    const v = get().variants.find((x) => x.id === id)
    if (!v) return
    const outlet = useActiveOutletStore.getState().activeOutletId
    const { after } = useInventoryStore.getState().applyDelta(outlet, v.product_id, id, -qty)
    set((s) => ({ variants: s.variants.map((x) => (x.id === id ? { ...x, stock: after } : x)) }))
  },

  incrementVariantStock: (id, qty) => {
    const v = get().variants.find((x) => x.id === id)
    if (!v) return
    const outlet = useActiveOutletStore.getState().activeOutletId
    const { after } = useInventoryStore.getState().applyDelta(outlet, v.product_id, id, qty)
    set((s) => ({ variants: s.variants.map((x) => (x.id === id ? { ...x, stock: after } : x)) }))
  },

  projectVariantStock: (outletId) => {
    const inv = useInventoryStore.getState()
    set((s) => ({
      variants: s.variants.map((v) => {
        const st = inv.stockAt(outletId, v.product_id, v.id)
        return st === null ? v : { ...v, stock: st }
      }),
    }))
  },
}))

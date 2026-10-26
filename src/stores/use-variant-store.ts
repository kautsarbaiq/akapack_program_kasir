import { create } from 'zustand'
import type { ProductVariant } from '@/types'
import { generateId } from '@/lib/utils'
import { DEFAULT_TENANT_ID } from '@/lib/supabase/config'
import { fetchAll, insertRow, updateRow, deleteRow } from '@/lib/supabase/repo'
import { useInventoryStore } from './use-inventory-store'
import { newMovementId, describeStockError, onStockReconciled } from '@/lib/stock/stock-sync'
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
  /** openingStock = angka stok varian saat form dibuka; stok hanya ditulis bila diubah dari angka itu. */
  updateVariant: (id: string, data: VariantFormValues, openingStock?: number) => void
  deleteVariant: (id: string) => void
  /** Kurangi stok varian saat transaksi POS */
  clearAll: () => void
  /** Kembalikan stok varian (mis. pesanan online dibatalkan) */
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
    // Stok awal varian dikirim setelah varian & produknya punya id server (fungsi stok butuh uuid).
    const openingOutlet = useActiveOutletStore.getState().activeOutletId
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
        if (data.stock > 0) {
          useInventoryStore.getState().applyStock([{
            id: newMovementId(), outlet_id: openingOutlet, product_id: productId, variant_id: saved.id,
            delta: data.stock, type: 'in', notes: `Stok awal varian ${data.name}`,
          }])
        }
      }
    })
    return v
  },

  updateVariant: (id, data, openingStock) => {
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
      const userChangedStock = openingStock !== undefined ? data.stock !== openingStock : (liveStock === null || data.stock !== liveStock)
      if (userChangedStock) {
        // Dulu ubah stok varian TANPA riwayat sama sekali. Kini angka absolut dihitung & dicatat server.
        void invStore.applyStockNow([{
          id: newMovementId(), outlet_id: outlet, product_id: pv.product_id, variant_id: id,
          set_to: Math.max(0, data.stock), type: 'adjustment', notes: `Ubah stok varian ${data.name}`,
        }]).then(({ failed }) => {
          if (!failed.length) return
          void import('sonner').then(({ toast }) => toast.error(
            `Stok varian "${data.name}" GAGAL disimpan: ${describeStockError(failed[0].code, failed[0].message)}.`, { duration: 12000 }))
        })
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

// Samakan field `stock` varian setiap kali stok disamakan dengan server.
if (typeof window !== 'undefined') {
  onStockReconciled(() => useVariantStore.getState().projectVariantStock(useActiveOutletStore.getState().activeOutletId))
}

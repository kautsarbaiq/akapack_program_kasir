import { create } from 'zustand'
import type { ProductVariant } from '@/types'
import { generateId } from '@/lib/utils'
import { DEFAULT_TENANT_ID } from '@/lib/supabase/config'
import { fetchAll, insertRow, updateRow, deleteRow } from '@/lib/supabase/repo'

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
  decrementVariantStock: (id: string, qty: number) => void
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
      if (saved) set((s) => ({ variants: s.variants.map((x) => (x.id === v.id ? saved : x)) }))
    })
    return v
  },

  updateVariant: (id, data) => {
    set((s) => ({
      variants: s.variants.map((v) =>
        v.id === id ? { ...v, name: data.name, sku: data.sku || undefined, price: data.price, cost_price: data.cost_price, stock: data.stock } : v
      ),
    }))
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

  decrementVariantStock: (id, qty) => {
    let newStock = 0
    set((s) => ({
      variants: s.variants.map((v) => {
        if (v.id !== id) return v
        newStock = Math.max(0, v.stock - qty)
        return { ...v, stock: newStock }
      }),
    }))
    void updateRow('product_variants', id, { stock: newStock })
  },
}))

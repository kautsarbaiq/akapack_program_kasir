import { create } from 'zustand'
import type { Product, ProductUnit, PriceTier } from '@/types'
import type { ProductFormValues } from '@/lib/validations'
import { mockProducts } from '@/lib/mock-data'
import { generateId, getStockStatus } from '@/lib/utils'
import { DEFAULT_TENANT_ID } from '@/lib/supabase/config'
import { fetchAll, insertRow, updateRow, deleteRow } from '@/lib/supabase/repo'
import { useCategoryStore } from './use-category-store'

interface ProductStore {
  products: Product[]
  loaded: boolean
  fetch: () => Promise<void>
  addProduct: (values: ProductFormValues, units?: ProductUnit[], priceTiers?: PriceTier[], priceOnline?: number) => Product
  updateProduct: (id: string, values: ProductFormValues, units?: ProductUnit[], priceTiers?: PriceTier[], priceOnline?: number) => void
  deleteProduct: (id: string) => void
  /** Kurangi stok saat transaksi POS */
  decrementStock: (id: string, qty: number) => void
  /** Set stok absolut (stok masuk / opname) */
  setStock: (id: string, newStock: number) => void
  /** Tandai produk punya varian */
  setHasVariants: (id: string, value: boolean) => void
  /** Set URL foto produk */
  setProductImage: (id: string, url: string) => void
}

function resolveCategory(categoryId: string) {
  return useCategoryStore.getState().categories.find((c) => c.id === categoryId)
}

export const useProductStore = create<ProductStore>()((set) => ({
  products: mockProducts,
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
      if (saved) set((s) => ({
        products: s.products.map((p) => (p.id === newProduct.id
          ? { ...saved, category: resolveCategory(saved.category_id), stock_status: getStockStatus(saved.stock, saved.min_stock) }
          : p)),
      }))
    })
    return newProduct
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
    void deleteRow('products', id)
  },

  decrementStock: (id, qty) => {
    let newStock = 0
    set((s) => ({
      products: s.products.map((p) => {
        if (p.id !== id) return p
        newStock = Math.max(0, p.stock - qty)
        return { ...p, stock: newStock, stock_status: getStockStatus(newStock, p.min_stock) }
      }),
    }))
    void updateRow('products', id, { stock: newStock })
  },

  setStock: (id, newStock) => {
    set((s) => ({
      products: s.products.map((p) =>
        p.id === id ? { ...p, stock: newStock, stock_status: getStockStatus(newStock, p.min_stock) } : p
      ),
    }))
    void updateRow('products', id, { stock: newStock })
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
}))

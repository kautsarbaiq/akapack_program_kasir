import { create } from 'zustand'
import type { Product } from '@/types'
import type { ProductFormValues } from '@/lib/validations'
import { mockProducts } from '@/lib/mock-data'
import { generateId, getStockStatus } from '@/lib/utils'
import { useCategoryStore } from './use-category-store'

interface ProductStore {
  products: Product[]
  addProduct: (values: ProductFormValues) => Product
  updateProduct: (id: string, values: ProductFormValues) => void
  deleteProduct: (id: string) => void
  /** Kurangi stok saat transaksi POS */
  decrementStock: (id: string, qty: number) => void
  /** Set stok absolut (stok masuk / opname) */
  setStock: (id: string, newStock: number) => void
}

function resolveCategory(categoryId: string) {
  return useCategoryStore.getState().categories.find((c) => c.id === categoryId)
}

export const useProductStore = create<ProductStore>()((set) => ({
  products: mockProducts,

  addProduct: (values) => {
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
      is_active: values.is_active,
      stock_status: getStockStatus(values.stock, values.min_stock),
      created_at: now,
      updated_at: now,
    }
    set((state) => ({ products: [newProduct, ...state.products] }))
    return newProduct
  },

  updateProduct: (id, values) =>
    set((state) => ({
      products: state.products.map((p) =>
        p.id === id
          ? {
              ...p,
              ...values,
              barcode: values.barcode || undefined,
              description: values.description || undefined,
              category: resolveCategory(values.category_id),
              stock_status: getStockStatus(values.stock, values.min_stock),
              updated_at: new Date().toISOString(),
            }
          : p
      ),
    })),

  deleteProduct: (id) =>
    set((state) => ({ products: state.products.filter((p) => p.id !== id) })),

  decrementStock: (id, qty) =>
    set((state) => ({
      products: state.products.map((p) => {
        if (p.id !== id) return p
        const stock = Math.max(0, p.stock - qty)
        return { ...p, stock, stock_status: getStockStatus(stock, p.min_stock) }
      }),
    })),

  setStock: (id, newStock) =>
    set((state) => ({
      products: state.products.map((p) =>
        p.id === id
          ? { ...p, stock: newStock, stock_status: getStockStatus(newStock, p.min_stock) }
          : p
      ),
    })),
}))

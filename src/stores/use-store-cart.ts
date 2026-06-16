import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface StoreCartItem {
  key: string
  product_id: string
  variant_id?: string
  name: string
  price: number
  quantity: number
  image_url?: string
}

interface StoreCart {
  items: StoreCartItem[]
  add: (item: Omit<StoreCartItem, 'quantity'>, qty?: number) => void
  updateQty: (key: string, qty: number) => void
  remove: (key: string) => void
  clear: () => void
}

// Keranjang pembeli online — dipersist ke localStorage agar tahan refresh.
export const useStoreCart = create<StoreCart>()(
  persist(
    (set) => ({
      items: [],
      add: (item, qty = 1) =>
        set((s) => {
          const ex = s.items.find((i) => i.key === item.key)
          if (ex) return { items: s.items.map((i) => (i.key === item.key ? { ...i, quantity: i.quantity + qty } : i)) }
          return { items: [...s.items, { ...item, quantity: qty }] }
        }),
      updateQty: (key, qty) =>
        set((s) => ({
          items: qty <= 0 ? s.items.filter((i) => i.key !== key) : s.items.map((i) => (i.key === key ? { ...i, quantity: qty } : i)),
        })),
      remove: (key) => set((s) => ({ items: s.items.filter((i) => i.key !== key) })),
      clear: () => set({ items: [] }),
    }),
    { name: 'akapack-store-cart', storage: createJSONStorage(() => localStorage), skipHydration: true }
  )
)

import { create } from 'zustand'
import type { Customer } from '@/types'
import { generateId } from '@/lib/utils'

export interface HeldCartItem {
  key: string
  product_id: string
  variant_id?: string
  product_name: string
  sku: string
  price: number
  quantity: number
  discount: number
  subtotal: number
  unit: string
  factor: number
}

export interface HeldOrder {
  id: string
  label: string
  cart: HeldCartItem[]
  customer: Customer | null
  discount: number
  pointsRedeem: number
  itemCount: number
  total: number
  createdAt: string
}

interface HeldOrderStore {
  held: HeldOrder[]
  hold: (order: Omit<HeldOrder, 'id' | 'createdAt'>) => void
  recall: (id: string) => HeldOrder | undefined
  remove: (id: string) => void
}

// In-memory (ephemeral per sesi) — pesanan tertahan tidak perlu persisten.
export const useHeldOrderStore = create<HeldOrderStore>()((set, get) => ({
  held: [],

  hold: (order) => {
    const entry: HeldOrder = { ...order, id: generateId('hold'), createdAt: new Date().toISOString() }
    set((s) => ({ held: [entry, ...s.held] }))
  },

  recall: (id) => {
    const found = get().held.find((h) => h.id === id)
    if (found) set((s) => ({ held: s.held.filter((h) => h.id !== id) }))
    return found
  },

  remove: (id) => set((s) => ({ held: s.held.filter((h) => h.id !== id) })),
}))

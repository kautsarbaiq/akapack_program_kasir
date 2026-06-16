import { create } from 'zustand'
import type { Customer } from '@/types'
import type { CustomerFormValues } from '@/lib/validations'
import { mockCustomers } from '@/lib/mock-data'
import { generateId } from '@/lib/utils'

/** Poin diperoleh: 1 poin per Rp1.000 belanja */
const POINTS_PER_RUPIAH = 1 / 1000

interface CustomerStore {
  customers: Customer[]
  addCustomer: (values: CustomerFormValues) => Customer
  updateCustomer: (id: string, values: CustomerFormValues) => void
  deleteCustomer: (id: string) => void
  addPoints: (id: string, points: number) => void
  /** Catat pembelian dari POS: tambah total belanja, transaksi, & poin */
  recordPurchase: (id: string, amount: number) => void
}

export const useCustomerStore = create<CustomerStore>()((set) => ({
  customers: mockCustomers,

  addCustomer: (values) => {
    const now = new Date().toISOString()
    const newCustomer: Customer = {
      id: generateId('cust'),
      outlet_id: 'outlet-1',
      name: values.name,
      phone: values.phone || undefined,
      email: values.email || undefined,
      address: values.address || undefined,
      points: values.points,
      total_spent: 0,
      total_transactions: 0,
      member_since: now,
      created_at: now,
    }
    set((state) => ({ customers: [newCustomer, ...state.customers] }))
    return newCustomer
  },

  updateCustomer: (id, values) =>
    set((state) => ({
      customers: state.customers.map((c) =>
        c.id === id
          ? {
              ...c,
              name: values.name,
              phone: values.phone || undefined,
              email: values.email || undefined,
              address: values.address || undefined,
              points: values.points,
            }
          : c
      ),
    })),

  deleteCustomer: (id) =>
    set((state) => ({ customers: state.customers.filter((c) => c.id !== id) })),

  addPoints: (id, points) =>
    set((state) => ({
      customers: state.customers.map((c) =>
        c.id === id ? { ...c, points: c.points + points } : c
      ),
    })),

  recordPurchase: (id, amount) =>
    set((state) => ({
      customers: state.customers.map((c) =>
        c.id === id
          ? {
              ...c,
              total_spent: c.total_spent + amount,
              total_transactions: c.total_transactions + 1,
              points: c.points + Math.floor(amount * POINTS_PER_RUPIAH),
            }
          : c
      ),
    })),
}))

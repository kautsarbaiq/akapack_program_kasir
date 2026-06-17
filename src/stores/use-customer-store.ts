import { create } from 'zustand'
import type { Customer } from '@/types'
import type { CustomerFormValues } from '@/lib/validations'
import { mockCustomers } from '@/lib/mock-data'
import { generateId } from '@/lib/utils'
import { DEFAULT_TENANT_ID, DEFAULT_OUTLET_ID, isSupabaseConfigured } from '@/lib/supabase/config'
import { fetchAll, insertRow, updateRow, deleteRow } from '@/lib/supabase/repo'

/** Poin diperoleh: 1 poin per Rp1.000 belanja */
const POINTS_PER_RUPIAH = 1 / 1000

interface CustomerStore {
  customers: Customer[]
  loaded: boolean
  fetch: () => Promise<void>
  addCustomer: (values: CustomerFormValues) => Customer
  updateCustomer: (id: string, values: CustomerFormValues) => void
  deleteCustomer: (id: string) => void
  addPoints: (id: string, points: number) => void
  /** Tukar/kurangi poin (redeem di POS) */
  redeemPoints: (id: string, points: number) => void
  /** Catat pembelian dari POS: tambah total belanja, transaksi, & poin */
  recordPurchase: (id: string, amount: number) => void
}

export const useCustomerStore = create<CustomerStore>()((set, get) => ({
  customers: isSupabaseConfigured() ? [] : mockCustomers,
  loaded: false,

  fetch: async () => {
    const rows = await fetchAll<Customer>('customers', 'created_at', false)
    if (rows) set({ customers: rows, loaded: true })
    else set({ loaded: true })
  },

  addCustomer: (values) => {
    const now = new Date().toISOString()
    const newCustomer: Customer = {
      id: generateId('cust'),
      outlet_id: DEFAULT_OUTLET_ID,
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
    set((s) => ({ customers: [newCustomer, ...s.customers] }))
    void insertRow<Customer>('customers', {
      tenant_id: DEFAULT_TENANT_ID,
      name: newCustomer.name,
      phone: newCustomer.phone || null,
      email: newCustomer.email || null,
      address: newCustomer.address || null,
      points: newCustomer.points,
    }).then((saved) => {
      if (saved) set((s) => ({ customers: s.customers.map((c) => (c.id === newCustomer.id ? saved : c)) }))
    })
    return newCustomer
  },

  updateCustomer: (id, values) => {
    set((s) => ({
      customers: s.customers.map((c) =>
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
    }))
    void updateRow('customers', id, {
      name: values.name,
      phone: values.phone || null,
      email: values.email || null,
      address: values.address || null,
      points: values.points,
    })
  },

  deleteCustomer: (id) => {
    set((s) => ({ customers: s.customers.filter((c) => c.id !== id) }))
    void deleteRow('customers', id)
  },

  addPoints: (id, points) => {
    let newPoints = 0
    set((s) => ({
      customers: s.customers.map((c) => {
        if (c.id !== id) return c
        newPoints = c.points + points
        return { ...c, points: newPoints }
      }),
    }))
    void updateRow('customers', id, { points: newPoints })
  },

  redeemPoints: (id, points) => {
    let newPoints = 0
    set((s) => ({
      customers: s.customers.map((c) => {
        if (c.id !== id) return c
        newPoints = Math.max(0, c.points - points)
        return { ...c, points: newPoints }
      }),
    }))
    void updateRow('customers', id, { points: newPoints })
  },

  recordPurchase: (id, amount) => {
    const cust = get().customers.find((c) => c.id === id)
    if (!cust) return
    const next = {
      total_spent: cust.total_spent + amount,
      total_transactions: cust.total_transactions + 1,
      points: cust.points + Math.floor(amount * POINTS_PER_RUPIAH),
    }
    set((s) => ({ customers: s.customers.map((c) => (c.id === id ? { ...c, ...next } : c)) }))
    void updateRow('customers', id, next)
  },
}))

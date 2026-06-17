import { create } from 'zustand'
import type { Supplier } from '@/types'
import { generateId } from '@/lib/utils'
import { DEFAULT_TENANT_ID } from '@/lib/supabase/config'
import { fetchAll, insertRow, updateRow, deleteRow } from '@/lib/supabase/repo'
import { mockSuppliers } from '@/lib/mock-data'

interface SupplierRow {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  is_active: boolean | null
  created_at: string
}

export interface SupplierInput {
  name: string
  phone?: string
  email?: string
  address?: string
  is_active?: boolean
}

interface SupplierStore {
  suppliers: Supplier[]
  loaded: boolean
  fetch: () => Promise<void>
  addSupplier: (data: SupplierInput) => Supplier
  updateSupplier: (id: string, data: SupplierInput) => void
  deleteSupplier: (id: string) => void
}

export const useSupplierStore = create<SupplierStore>()((set) => ({
  suppliers: mockSuppliers,
  loaded: false,

  fetch: async () => {
    const rows = await fetchAll<SupplierRow>('suppliers', 'name', true)
    if (!rows) {
      set({ loaded: true })
      return
    }
    const mapped: Supplier[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone ?? undefined,
      email: r.email ?? undefined,
      address: r.address ?? undefined,
      is_active: r.is_active ?? true,
      created_at: r.created_at,
    }))
    set({ suppliers: mapped, loaded: true })
  },

  addSupplier: (data) => {
    const sup: Supplier = {
      id: generateId('sup'),
      name: data.name,
      phone: data.phone,
      email: data.email,
      address: data.address,
      is_active: data.is_active ?? true,
      created_at: new Date().toISOString(),
    }
    set((s) => ({ suppliers: [...s.suppliers, sup] }))
    void insertRow<SupplierRow>('suppliers', {
      tenant_id: DEFAULT_TENANT_ID,
      name: sup.name,
      phone: sup.phone ?? null,
      email: sup.email ?? null,
      address: sup.address ?? null,
      is_active: sup.is_active,
    }).then((row) => {
      if (row) set((s) => ({ suppliers: s.suppliers.map((x) => (x.id === sup.id ? { ...x, id: row.id } : x)) }))
    })
    return sup
  },

  updateSupplier: (id, data) => {
    set((s) => ({ suppliers: s.suppliers.map((x) => (x.id === id ? { ...x, ...data, is_active: data.is_active ?? x.is_active } : x)) }))
    void updateRow('suppliers', id, {
      name: data.name,
      phone: data.phone ?? null,
      email: data.email ?? null,
      address: data.address ?? null,
      is_active: data.is_active ?? true,
    })
  },

  deleteSupplier: (id) => {
    set((s) => ({ suppliers: s.suppliers.filter((x) => x.id !== id) }))
    void deleteRow('suppliers', id)
  },
}))

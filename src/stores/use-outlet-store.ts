import { create } from 'zustand'
import type { Outlet } from '@/types'
import { generateId } from '@/lib/utils'
import { DEFAULT_TENANT_ID, DEFAULT_OUTLET_ID } from '@/lib/supabase/config'
import { fetchAll, insertRow, updateRow, deleteRow } from '@/lib/supabase/repo'

interface OutletRow {
  id: string
  name: string
  address: string | null
  phone: string | null
  email: string | null
  is_active: boolean | null
  created_at: string
}

export interface OutletInput {
  name: string
  address?: string
  phone?: string
  email?: string
  is_active?: boolean
}

const SECOND_OUTLET_ID = '00000000-0000-0000-0000-000000000003'

// Cocok dengan seed migration 0011 agar konsisten mock ↔ DB.
const MOCK_OUTLETS: Outlet[] = [
  { id: DEFAULT_OUTLET_ID, name: 'Outlet Pusat', address: 'Kantor Pusat', tax_rate: 0, service_charge: 0, is_active: true, created_at: '2025-01-01' },
  { id: SECOND_OUTLET_ID, name: 'Cabang 2', address: 'Cabang Kedua', tax_rate: 0, service_charge: 0, is_active: true, created_at: '2025-01-01' },
]

interface OutletStore {
  outlets: Outlet[]
  loaded: boolean
  fetch: () => Promise<void>
  addOutlet: (data: OutletInput) => Outlet
  updateOutlet: (id: string, data: OutletInput) => void
  deleteOutlet: (id: string) => void
}

export const useOutletStore = create<OutletStore>()((set) => ({
  outlets: MOCK_OUTLETS,
  loaded: false,

  fetch: async () => {
    const rows = await fetchAll<OutletRow>('outlets', 'name', true)
    if (!rows || rows.length === 0) {
      set({ loaded: true })
      return
    }
    const mapped: Outlet[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      address: r.address ?? '',
      phone: r.phone ?? undefined,
      email: r.email ?? undefined,
      tax_rate: 0,
      service_charge: 0,
      is_active: r.is_active ?? true,
      created_at: r.created_at,
    }))
    set({ outlets: mapped, loaded: true })
  },

  addOutlet: (data) => {
    const o: Outlet = {
      id: generateId('outlet'),
      name: data.name,
      address: data.address ?? '',
      phone: data.phone,
      email: data.email,
      tax_rate: 0,
      service_charge: 0,
      is_active: data.is_active ?? true,
      created_at: new Date().toISOString(),
    }
    set((s) => ({ outlets: [...s.outlets, o] }))
    void insertRow<OutletRow>('outlets', {
      tenant_id: DEFAULT_TENANT_ID,
      name: o.name,
      address: o.address || null,
      phone: o.phone ?? null,
      email: o.email ?? null,
      is_active: o.is_active,
    }).then((row) => {
      if (row) set((s) => ({ outlets: s.outlets.map((x) => (x.id === o.id ? { ...x, id: row.id } : x)) }))
    })
    return o
  },

  updateOutlet: (id, data) => {
    set((s) => ({ outlets: s.outlets.map((x) => (x.id === id ? { ...x, ...data, address: data.address ?? x.address, is_active: data.is_active ?? x.is_active } : x)) }))
    void updateRow('outlets', id, {
      name: data.name,
      address: data.address ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      is_active: data.is_active ?? true,
    })
  },

  deleteOutlet: (id) => {
    set((s) => ({ outlets: s.outlets.filter((x) => x.id !== id) }))
    void deleteRow('outlets', id)
  },
}))

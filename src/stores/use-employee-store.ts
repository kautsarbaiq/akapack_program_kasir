import { create } from 'zustand'
import type { Employee } from '@/types'
import type { EmployeeFormValues } from '@/lib/validations'
import { mockEmployees } from '@/lib/mock-data'
import { generateId } from '@/lib/utils'
import { DEFAULT_TENANT_ID } from '@/lib/supabase/config'
import { fetchAll, insertRow, updateRow, deleteRow } from '@/lib/supabase/repo'

interface EmployeeStore {
  employees: Employee[]
  loaded: boolean
  fetch: () => Promise<void>
  addEmployee: (values: EmployeeFormValues) => Employee
  updateEmployee: (id: string, values: EmployeeFormValues) => void
  deleteEmployee: (id: string) => void
  toggleActive: (id: string) => void
}

export const useEmployeeStore = create<EmployeeStore>()((set, get) => ({
  employees: mockEmployees,
  loaded: false,

  fetch: async () => {
    const rows = await fetchAll<Employee>('employees', 'created_at', false)
    if (rows) set({ employees: rows, loaded: true })
    else set({ loaded: true })
  },

  addEmployee: (values) => {
    const newEmployee: Employee = {
      id: generateId('emp'),
      outlet_id: 'outlet-1',
      name: values.name,
      role: values.role,
      pin: values.pin || undefined,
      phone: values.phone || undefined,
      email: values.email || undefined,
      is_active: values.is_active,
      created_at: new Date().toISOString(),
    }
    set((s) => ({ employees: [newEmployee, ...s.employees] }))
    void insertRow<Employee>('employees', {
      tenant_id: DEFAULT_TENANT_ID,
      name: newEmployee.name,
      role: newEmployee.role,
      pin: newEmployee.pin || null,
      phone: newEmployee.phone || null,
      email: newEmployee.email || null,
      is_active: newEmployee.is_active,
    }).then((saved) => {
      if (saved) set((s) => ({ employees: s.employees.map((e) => (e.id === newEmployee.id ? saved : e)) }))
    })
    return newEmployee
  },

  updateEmployee: (id, values) => {
    set((s) => ({
      employees: s.employees.map((e) =>
        e.id === id
          ? {
              ...e,
              name: values.name,
              role: values.role,
              pin: values.pin || undefined,
              phone: values.phone || undefined,
              email: values.email || undefined,
              is_active: values.is_active,
            }
          : e
      ),
    }))
    void updateRow('employees', id, {
      name: values.name,
      role: values.role,
      pin: values.pin || null,
      phone: values.phone || null,
      email: values.email || null,
      is_active: values.is_active,
    })
  },

  deleteEmployee: (id) => {
    set((s) => ({ employees: s.employees.filter((e) => e.id !== id) }))
    void deleteRow('employees', id)
  },

  toggleActive: (id) => {
    const emp = get().employees.find((e) => e.id === id)
    if (!emp) return
    const next = !emp.is_active
    set((s) => ({ employees: s.employees.map((e) => (e.id === id ? { ...e, is_active: next } : e)) }))
    void updateRow('employees', id, { is_active: next })
  },
}))

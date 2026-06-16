import { create } from 'zustand'
import type { Employee } from '@/types'
import type { EmployeeFormValues } from '@/lib/validations'
import { mockEmployees } from '@/lib/mock-data'
import { generateId } from '@/lib/utils'

interface EmployeeStore {
  employees: Employee[]
  addEmployee: (values: EmployeeFormValues) => Employee
  updateEmployee: (id: string, values: EmployeeFormValues) => void
  deleteEmployee: (id: string) => void
  toggleActive: (id: string) => void
}

export const useEmployeeStore = create<EmployeeStore>()((set) => ({
  employees: mockEmployees,

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
    set((state) => ({ employees: [newEmployee, ...state.employees] }))
    return newEmployee
  },

  updateEmployee: (id, values) =>
    set((state) => ({
      employees: state.employees.map((e) =>
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
    })),

  deleteEmployee: (id) =>
    set((state) => ({ employees: state.employees.filter((e) => e.id !== id) })),

  toggleActive: (id) =>
    set((state) => ({
      employees: state.employees.map((e) =>
        e.id === id ? { ...e, is_active: !e.is_active } : e
      ),
    })),
}))

import { create } from 'zustand'
import type { Employee, Shift } from '@/types'
import { generateId } from '@/lib/utils'

interface ShiftStore {
  currentShift: Shift | null
  openShift: (employee: Employee, openingCash: number) => Shift
  /** Tutup shift; mengembalikan snapshot shift yg ditutup untuk ringkasan */
  closeShift: (closingCash: number) => Shift | null
  /** Catat penjualan ke shift berjalan */
  recordSale: (amount: number) => void
}

export const useShiftStore = create<ShiftStore>()((set, get) => ({
  currentShift: null,

  openShift: (employee, openingCash) => {
    const shift: Shift = {
      id: generateId('shift'),
      outlet_id: 'outlet-1',
      employee_id: employee.id,
      employee,
      opening_cash: openingCash,
      total_sales: 0,
      total_transactions: 0,
      status: 'open',
      opened_at: new Date().toISOString(),
    }
    set({ currentShift: shift })
    return shift
  },

  closeShift: (closingCash) => {
    const current = get().currentShift
    if (!current) return null
    const closed: Shift = {
      ...current,
      closing_cash: closingCash,
      status: 'closed',
      closed_at: new Date().toISOString(),
    }
    set({ currentShift: null })
    return closed
  },

  recordSale: (amount) =>
    set((state) =>
      state.currentShift
        ? {
            currentShift: {
              ...state.currentShift,
              total_sales: state.currentShift.total_sales + amount,
              total_transactions: state.currentShift.total_transactions + 1,
            },
          }
        : state
    ),
}))

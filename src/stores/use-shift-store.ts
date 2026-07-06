import { create } from 'zustand'
import type { Employee, Shift } from '@/types'
import { generateId } from '@/lib/utils'
import { getSupabaseBrowser } from '@/lib/supabase/client'
import { isSupabaseConfigured, DEFAULT_TENANT_ID, DEFAULT_OUTLET_ID } from '@/lib/supabase/config'
import { updateRow } from '@/lib/supabase/repo'
import { useEmployeeStore } from './use-employee-store'
import { useActiveOutletStore } from './use-active-outlet-store'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (s?: string | null): s is string => !!s && UUID_RE.test(s)

interface ShiftRow {
  id: string
  outlet_id: string
  employee_id: string | null
  opening_cash: number
  closing_cash: number | null
  total_sales: number
  total_transactions: number
  status: 'open' | 'closed'
  opened_at: string
  closed_at: string | null
}

async function persistShiftOpen(shift: Shift): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  try {
    const { data, error } = await getSupabaseBrowser()
      .from('shifts')
      .insert({
        tenant_id: DEFAULT_TENANT_ID,
        outlet_id: isUuid(shift.outlet_id) ? shift.outlet_id : null,
        employee_id: isUuid(shift.employee_id) ? shift.employee_id : null,
        opening_cash: shift.opening_cash,
        total_sales: 0,
        total_transactions: 0,
        status: 'open',
        opened_at: shift.opened_at,
      })
      .select('id')
      .single()
    if (error || !data) {
      console.warn('[akapack] gagal buka shift:', error?.message)
      return null
    }
    return (data as { id: string }).id
  } catch (e) {
    console.warn('[akapack] error buka shift:', e)
    return null
  }
}

interface ShiftStore {
  currentShift: Shift | null
  loaded: boolean
  fetch: () => Promise<void>
  openShift: (employee: Employee, openingCash: number) => Shift
  /** Tutup shift; mengembalikan snapshot shift yg ditutup untuk ringkasan */
  closeShift: (closingCash: number) => Shift | null
  /** Catat penjualan ke shift berjalan */
  recordSale: (amount: number) => void
}

export const useShiftStore = create<ShiftStore>()((set, get) => ({
  currentShift: null,
  loaded: false,

  fetch: async () => {
    if (!isSupabaseConfigured()) {
      set({ loaded: true })
      return
    }
    try {
      // PENTING: shift di-scope per CABANG aktif. Tanpa filter ini, POS Bandung bisa
      // menampilkan shift kasir Garut (atau sebaliknya) — "kasir bertugas berubah sendiri".
      const activeOutletId = useActiveOutletStore.getState().activeOutletId
      let q = getSupabaseBrowser()
        .from('shifts')
        .select('*')
        .eq('status', 'open')
      if (isUuid(activeOutletId)) q = q.eq('outlet_id', activeOutletId)
      const { data, error } = await q.order('opened_at', { ascending: false })
      if (error || !data || !data.length) {
        set({ loaded: true })
        return
      }
      const rows = data as unknown as ShiftRow[]
      // Auto-close shift yang dibuka SEBELUM hari ini DAN sudah >12 jam (kasir lupa "Tutup Shift")
      // → shift lama tak menumpuk, TAPI shift lembur yang lewat tengah malam tidak ikut tertutup.
      // Hanya menandai status; data shift & transaksi tetap utuh.
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
      const todayMs = todayStart.getTime()
      const staleMs = Date.now() - 12 * 3600_000
      const isStale = (s: ShiftRow) => { const t = new Date(s.opened_at).getTime(); return t < todayMs && t < staleMs }
      for (const s of rows) {
        if (isStale(s) && isUuid(s.id)) {
          void updateRow('shifts', s.id, { status: 'closed', closed_at: new Date().toISOString() })
        }
      }
      // Shift berjalan = shift open TERBARU yang belum basi (hari ini, atau lembur lewat tengah malam).
      const r = rows.find((s) => !isStale(s))
      if (!r) {
        set({ currentShift: null, loaded: true })
        return
      }
      const emp = useEmployeeStore.getState().employees.find((e) => e.id === r.employee_id)
      set({
        currentShift: {
          id: r.id,
          outlet_id: r.outlet_id,
          employee_id: r.employee_id ?? '',
          employee: emp,
          opening_cash: r.opening_cash,
          closing_cash: r.closing_cash ?? undefined,
          total_sales: r.total_sales,
          total_transactions: r.total_transactions,
          status: 'open',
          opened_at: r.opened_at,
          closed_at: r.closed_at ?? undefined,
        },
        loaded: true,
      })
    } catch {
      set({ loaded: true })
    }
  },

  openShift: (employee, openingCash) => {
    const activeOutletId = useActiveOutletStore.getState().activeOutletId
    const shift: Shift = {
      id: generateId('shift'),
      outlet_id: isUuid(activeOutletId) ? activeOutletId : DEFAULT_OUTLET_ID,
      employee_id: employee.id,
      employee,
      opening_cash: openingCash,
      total_sales: 0,
      total_transactions: 0,
      status: 'open',
      opened_at: new Date().toISOString(),
    }
    set({ currentShift: shift })
    void persistShiftOpen(shift).then((newId) => {
      if (!newId) return
      set((s) => (s.currentShift && s.currentShift.id === shift.id ? { currentShift: { ...s.currentShift, id: newId } } : s))
    })
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
    if (isUuid(current.id)) {
      void updateRow('shifts', current.id, {
        closing_cash: closingCash,
        status: 'closed',
        closed_at: closed.closed_at,
      })
    }
    return closed
  },

  recordSale: (amount) => {
    const cur = get().currentShift
    if (!cur) return
    const next = {
      total_sales: cur.total_sales + amount,
      total_transactions: cur.total_transactions + 1,
    }
    set({ currentShift: { ...cur, ...next } })
    if (isUuid(cur.id)) void updateRow('shifts', cur.id, next)
  },
}))

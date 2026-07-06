import { create } from 'zustand'
import type { Attendance, Employee } from '@/types'
import { getSupabaseBrowser } from '@/lib/supabase/client'
import { isSupabaseConfigured, DEFAULT_TENANT_ID } from '@/lib/supabase/config'
import { generateId, localDay } from '@/lib/utils'
import { useEmployeeStore } from './use-employee-store'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (s?: string | null): s is string => !!s && UUID_RE.test(s)

interface AttendanceRow {
  id: string
  employee_id: string
  outlet_id: string | null
  type: 'in' | 'out'
  timestamp: string
  created_at: string
}

const sameDay = (a: string, b: string) => localDay(a) === localDay(b)

interface AttendanceStore {
  records: Attendance[]
  loaded: boolean
  fetch: () => Promise<void>
  /** Catat clock-in/out; tipe ditentukan otomatis (toggle dari status hari ini). */
  clock: (employee: Employee, outletId: string) => { type: 'in' | 'out'; time: string }
  /** Record terakhir karyawan hari ini (untuk status hadir). */
  lastToday: (employeeId: string) => Attendance | undefined
}

export const useAttendanceStore = create<AttendanceStore>()((set, get) => ({
  records: [],
  loaded: false,

  fetch: async () => {
    if (!isSupabaseConfigured()) {
      set({ loaded: true })
      return
    }
    try {
      // Paginasi: hindari batas 1000 baris PostgREST — absensi lama tidak boleh hilang.
      const data: AttendanceRow[] = []
      for (let from = 0; ; from += 1000) {
        const { data: page, error } = await getSupabaseBrowser()
          .from('attendance')
          .select('*')
          .order('timestamp', { ascending: false }).order('id', { ascending: true })
          .range(from, from + 999)
        if (error) { if (from === 0) { set({ loaded: true }); return } break }
        const rows = (page ?? []) as AttendanceRow[]
        data.push(...rows)
        if (rows.length < 1000) break
      }
      const employees = useEmployeeStore.getState().employees
      const mapped: Attendance[] = (data as AttendanceRow[]).map((r) => ({
        id: r.id,
        employee_id: r.employee_id,
        employee: employees.find((e) => e.id === r.employee_id),
        outlet_id: r.outlet_id ?? undefined,
        type: r.type,
        timestamp: r.timestamp,
        created_at: r.created_at,
      }))
      set({ records: mapped, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },

  lastToday: (employeeId) => {
    const today = new Date().toISOString()
    return get().records.find((r) => r.employee_id === employeeId && sameDay(r.timestamp, today))
  },

  clock: (employee, outletId) => {
    const last = get().lastToday(employee.id)
    const type: 'in' | 'out' = last && last.type === 'in' ? 'out' : 'in'
    const now = new Date().toISOString()
    const rec: Attendance = {
      id: generateId('att'),
      employee_id: employee.id,
      employee,
      outlet_id: outletId,
      type,
      timestamp: now,
      created_at: now,
    }
    set((s) => ({ records: [rec, ...s.records] }))
    if (isSupabaseConfigured() && isUuid(employee.id)) {
      void (async () => {
        const { data } = await getSupabaseBrowser()
          .from('attendance')
          .insert({
            tenant_id: DEFAULT_TENANT_ID,
            employee_id: employee.id,
            outlet_id: isUuid(outletId) ? outletId : null,
            type,
            timestamp: now,
          })
          .select('id')
          .single()
        if (data) set((s) => ({ records: s.records.map((r) => (r.id === rec.id ? { ...r, id: (data as { id: string }).id } : r)) }))
      })()
    }
    return { type, time: now }
  },
}))

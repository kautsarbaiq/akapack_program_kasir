import { create } from 'zustand'
import { getSupabaseBrowser } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { useEmployeeStore } from './use-employee-store'
import { useActiveOutletStore } from './use-active-outlet-store'

const STAFF_KEY = 'akapack-staff'

export interface CurrentUser {
  name: string
  email: string
  role: string
  outletId?: string | null   // cabang user; null = semua cabang (owner/manager)
  employeeId?: string         // id karyawan (untuk absensi & shift)
  viaStaff?: boolean          // true bila login via nama+PIN (karyawan)
}

interface StaffSaved { employeeId: string; name: string; role: string; outletId: string }

function readStaff(): StaffSaved | null {
  if (typeof window === 'undefined') return null
  try { const r = localStorage.getItem(STAFF_KEY); return r ? (JSON.parse(r) as StaffSaved) : null } catch { return null }
}
const ROLE_KEY = 'akapack-role'
/** Tulis peran ke cookie agar middleware (proxy.ts) bisa menolak akses rute sensitif owner di SERVER. */
export function setRoleCookie(role: string | null) {
  if (typeof window === 'undefined') return
  try {
    if (role) document.cookie = `${ROLE_KEY}=${role.toLowerCase()}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`
    else document.cookie = `${ROLE_KEY}=; path=/; max-age=0; samesite=lax`
  } catch { /* noop */ }
}

function writeStaff(s: StaffSaved | null) {
  if (typeof window === 'undefined') return
  try {
    if (s) {
      localStorage.setItem(STAFF_KEY, JSON.stringify(s))
      // Cookie penanda agar middleware (proxy.ts) mengizinkan akses (sesi karyawan, bukan Supabase).
      document.cookie = `${STAFF_KEY}=1; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`
      setRoleCookie(s.role)
    } else {
      localStorage.removeItem(STAFF_KEY)
      document.cookie = `${STAFF_KEY}=; path=/; max-age=0; samesite=lax`
      setRoleCookie(null)
    }
  } catch { /* noop */ }
}

/** Hapus sesi karyawan (dipanggil saat owner login via email atau saat logout). */
export function clearStaffSession() { writeStaff(null) }

/** Ada sesi karyawan aktif (nama+PIN)? Dipakai AuthGuard agar karyawan tak dilempar ke /login. */
export function hasStaffSession(): boolean { return readStaff() !== null }

/** Hak akses berdasar peran. owner = penuh; manager = pengawasan (tanpa laba/modal/edit-tx);
 *  sales = buat surat pesanan; cashier = terbatas. */
export function useRole() {
  const role = useCurrentUserStore((s) => (s.user?.role || '').toLowerCase())
  const isOwner = role === 'owner'
  const isManager = role === 'manager'
  const isSales = role === 'sales'
  return {
    role,
    isOwner,
    isManager,
    isSales,
    isCashier: !isOwner && !isManager && !isSales, // sales BUKAN cashier
    canSeeCost: isOwner,       // harga modal / nilai stok (sensitif) — hanya owner
    canSeeProfit: isOwner,     // laba / margin — hanya owner
    canEditTx: isOwner,        // edit / void transaksi — hanya owner
    canEditStock: isOwner || isManager, // input/ubah stok & barang — owner + manager
    canCreateOrder: isOwner || isManager || isSales, // buat surat pesanan
  }
}

interface CurrentUserStore {
  user: CurrentUser | null
  loaded: boolean
  /** Muat user aktif: sesi karyawan (nama+PIN) diutamakan, lalu sesi Supabase (owner). */
  fetch: () => Promise<void>
  /** Login karyawan via nama + PIN. Return pesan error, atau null bila sukses. */
  staffLogin: (name: string, pin: string) => Promise<string | null>
  /** Keluar dari semua sesi (karyawan & owner). */
  logout: () => Promise<void>
}

export const useCurrentUserStore = create<CurrentUserStore>()((set) => ({
  user: null,
  loaded: false,

  fetch: async () => {
    // 1) Sesi karyawan (nama+PIN) diprioritaskan — TAPI divalidasi ulang ke data karyawan TERBARU.
    //    Role/cabang bisa berubah sejak sesi disimpan (mis. cashier dinaikkan jadi owner); jangan
    //    pakai peran basi dari localStorage. Kalau karyawan sudah nonaktif/terhapus → akhiri sesi.
    const staff = readStaff()
    if (staff) {
      const emp = useEmployeeStore.getState().employees.find((e) => e.id === staff.employeeId)
      if (emp && !emp.is_active) { writeStaff(null); set({ user: null, loaded: true }); return }
      const role = emp?.role ?? staff.role
      const outletId = emp?.outlet_id ?? staff.outletId
      const name = emp?.name ?? staff.name
      if (emp) writeStaff({ employeeId: staff.employeeId, name, role, outletId: outletId ?? '' }) // segarkan sesi tersimpan
      else setRoleCookie(role)
      if (outletId) useActiveOutletStore.getState().setActiveOutlet(outletId) // kunci ke cabang (owner: null → biarkan)
      set({ user: { name, email: '', role, outletId: outletId ?? null, employeeId: staff.employeeId, viaStaff: true }, loaded: true })
      return
    }
    // 2) Mode demo (Supabase belum dikonfigurasi).
    if (!isSupabaseConfigured()) {
      setRoleCookie('owner')
      set({ user: { name: 'Mode Demo', email: '', role: 'owner', outletId: null }, loaded: true })
      return
    }
    // 3) Sesi Supabase = owner/manager (login via email). Cocokkan email ke data karyawan.
    try {
      const { data } = await getSupabaseBrowser().auth.getSession()
      const u = data.session?.user
      if (!u) { setRoleCookie(null); set({ user: null, loaded: true }); return }
      const email = u.email ?? ''
      const emp = useEmployeeStore.getState().employees.find(
        (e) => e.email && e.email.toLowerCase() === email.toLowerCase()
      )
      const metaName = (u.user_metadata?.full_name as string | undefined) ?? ''
      const name = emp?.name || metaName || (email ? email.split('@')[0] : 'Pengguna')
      // Default DIBALIK: akun email tak dikenal = 'cashier' (terbatas), BUKAN owner.
      // Owner harus terdaftar di data karyawan dgn role owner (email cocok).
      const role = emp?.role || (u.user_metadata?.role as string | undefined) || 'cashier'
      setRoleCookie(role)
      set({ user: { name, email, role, outletId: emp?.outlet_id ?? null, employeeId: emp?.id, viaStaff: false }, loaded: true })
    } catch {
      set({ user: null, loaded: true })
    }
  },

  staffLogin: async (name, pin) => {
    let employees = useEmployeeStore.getState().employees
    if (!employees.length) { await useEmployeeStore.getState().fetch(); employees = useEmployeeStore.getState().employees }
    const nm = name.trim().toLowerCase()
    const p = pin.trim()
    if (!nm || !p) return 'Nama dan PIN wajib diisi.'
    const matches = employees.filter(
      (e) => e.is_active && e.name.trim().toLowerCase() === nm && (String(e.pin ?? '') === p || String(e.code ?? '') === p)
    )
    if (matches.length === 0) return 'Nama atau PIN salah, atau karyawan belum terdaftar.'
    // Cegah login ke cabang yang salah saat ada karyawan senama + PIN sama di 2 cabang.
    if (matches.length > 1) return 'Nama & PIN cocok ke lebih dari 1 karyawan — hubungi owner agar PIN dibuat unik.'
    const emp = matches[0]
    if (!emp.outlet_id) return 'Karyawan ini belum ditetapkan cabangnya. Hubungi owner.'
    writeStaff({ employeeId: emp.id, name: emp.name, role: emp.role, outletId: emp.outlet_id })
    useActiveOutletStore.getState().setActiveOutlet(emp.outlet_id) // kunci ke cabang karyawan
    set({ user: { name: emp.name, email: '', role: emp.role, outletId: emp.outlet_id, employeeId: emp.id, viaStaff: true }, loaded: true })
    return null
  },

  logout: async () => {
    writeStaff(null)
    if (isSupabaseConfigured()) { try { await getSupabaseBrowser().auth.signOut() } catch { /* noop */ } }
    set({ user: null, loaded: true })
  },
}))

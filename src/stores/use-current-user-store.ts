import { create } from 'zustand'
import { getSupabaseBrowser } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { useEmployeeStore } from './use-employee-store'

export interface CurrentUser {
  name: string
  email: string
  role: string
}

interface CurrentUserStore {
  user: CurrentUser | null
  loaded: boolean
  /** Muat user yang sedang login dari sesi Supabase; nama/role di-resolve dari data karyawan via email. */
  fetch: () => Promise<void>
}

export const useCurrentUserStore = create<CurrentUserStore>()((set) => ({
  user: null,
  loaded: false,

  fetch: async () => {
    if (!isSupabaseConfigured()) {
      set({ user: { name: 'Mode Demo', email: '', role: 'owner' }, loaded: true })
      return
    }
    try {
      const { data } = await getSupabaseBrowser().auth.getSession()
      const u = data.session?.user
      if (!u) {
        set({ user: null, loaded: true })
        return
      }
      const email = u.email ?? ''
      // Cocokkan email ke karyawan untuk nama & role; fallback ke metadata, lalu prefix email.
      const emp = useEmployeeStore.getState().employees.find(
        (e) => e.email && e.email.toLowerCase() === email.toLowerCase()
      )
      const metaName = (u.user_metadata?.full_name as string | undefined) ?? ''
      const name = emp?.name || metaName || (email ? email.split('@')[0] : 'Pengguna')
      const role = emp?.role || (u.user_metadata?.role as string | undefined) || 'owner'
      set({ user: { name, email, role }, loaded: true })
    } catch {
      set({ user: null, loaded: true })
    }
  },
}))

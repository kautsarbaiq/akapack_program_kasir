import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { DEFAULT_OUTLET_ID } from '@/lib/supabase/config'

interface ActiveOutletStore {
  activeOutletId: string
  setActiveOutlet: (id: string) => void
}

// Outlet yang sedang dioperasikan (POS, inventori, dst). Dipersist agar tahan refresh.
export const useActiveOutletStore = create<ActiveOutletStore>()(
  persist(
    (set) => ({
      activeOutletId: DEFAULT_OUTLET_ID,
      setActiveOutlet: (id) => set({ activeOutletId: id }),
    }),
    { name: 'akapack-active-outlet', storage: createJSONStorage(() => localStorage), skipHydration: true }
  )
)

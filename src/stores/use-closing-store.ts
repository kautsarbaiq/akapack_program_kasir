import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface ClosingStore {
  /** Tanggal terakhir buku ditutup (ISO date). Jurnal manual sebelum/di tanggal ini dikunci. */
  closedUntil: string | null
  close: (date: string) => void
  reopen: () => void
}

export const useClosingStore = create<ClosingStore>()(
  persist(
    (set) => ({
      closedUntil: null,
      close: (date) => set({ closedUntil: date }),
      reopen: () => set({ closedUntil: null }),
    }),
    { name: 'akapack-closing', storage: createJSONStorage(() => localStorage), skipHydration: true }
  )
)

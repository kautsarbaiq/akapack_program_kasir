import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Asset } from '@/types'
import { mockAssets } from '@/lib/mock-data'
import { generateId } from '@/lib/utils'

export interface AssetInput {
  name: string
  category: string
  acquired_at: string
  cost: number
  salvage: number
  useful_life_months: number
  is_active?: boolean
}

interface AssetStore {
  assets: Asset[]
  addAsset: (d: AssetInput) => void
  updateAsset: (id: string, d: AssetInput) => void
  deleteAsset: (id: string) => void
}

// Register aset dipersist ke localStorage (volume kecil; dampak finansial ada di jurnal penyusutan).
export const useAssetStore = create<AssetStore>()(
  persist(
    (set) => ({
      assets: mockAssets,
      addAsset: (d) =>
        set((s) => ({
          assets: [
            ...s.assets,
            {
              id: generateId('aset'),
              name: d.name,
              category: d.category,
              acquired_at: d.acquired_at,
              cost: d.cost,
              salvage: d.salvage,
              useful_life_months: d.useful_life_months,
              is_active: d.is_active ?? true,
              created_at: new Date().toISOString(),
            },
          ],
        })),
      updateAsset: (id, d) => set((s) => ({ assets: s.assets.map((a) => (a.id === id ? { ...a, ...d, is_active: d.is_active ?? a.is_active } : a)) })),
      deleteAsset: (id) => set((s) => ({ assets: s.assets.filter((a) => a.id !== id) })),
    }),
    { name: 'akapack-assets', storage: createJSONStorage(() => localStorage), skipHydration: true }
  )
)

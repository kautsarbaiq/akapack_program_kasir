import { create } from 'zustand'
import type { Promotion } from '@/types'
import type { PromotionFormValues } from '@/lib/validations'
import { mockPromotions } from '@/lib/mock-data'
import { generateId } from '@/lib/utils'

interface PromotionStore {
  promotions: Promotion[]
  addPromotion: (values: PromotionFormValues) => Promotion
  updatePromotion: (id: string, values: PromotionFormValues) => void
  deletePromotion: (id: string) => void
  toggleActive: (id: string) => void
}

export const usePromotionStore = create<PromotionStore>()((set) => ({
  promotions: mockPromotions,

  addPromotion: (values) => {
    const newPromotion: Promotion = {
      id: generateId('promo'),
      outlet_id: 'outlet-1',
      name: values.name,
      type: values.type,
      value: values.value,
      min_purchase: values.min_purchase || undefined,
      code: values.code || undefined,
      max_uses: values.max_uses || undefined,
      used_count: 0,
      starts_at: values.starts_at,
      ends_at: values.ends_at,
      is_active: values.is_active,
      created_at: new Date().toISOString(),
    }
    set((state) => ({ promotions: [newPromotion, ...state.promotions] }))
    return newPromotion
  },

  updatePromotion: (id, values) =>
    set((state) => ({
      promotions: state.promotions.map((p) =>
        p.id === id
          ? {
              ...p,
              name: values.name,
              type: values.type,
              value: values.value,
              min_purchase: values.min_purchase || undefined,
              code: values.code || undefined,
              max_uses: values.max_uses || undefined,
              starts_at: values.starts_at,
              ends_at: values.ends_at,
              is_active: values.is_active,
            }
          : p
      ),
    })),

  deletePromotion: (id) =>
    set((state) => ({ promotions: state.promotions.filter((p) => p.id !== id) })),

  toggleActive: (id) =>
    set((state) => ({
      promotions: state.promotions.map((p) =>
        p.id === id ? { ...p, is_active: !p.is_active } : p
      ),
    })),
}))

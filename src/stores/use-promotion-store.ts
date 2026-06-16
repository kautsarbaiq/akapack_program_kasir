import { create } from 'zustand'
import type { Promotion } from '@/types'
import type { PromotionFormValues } from '@/lib/validations'
import { mockPromotions } from '@/lib/mock-data'
import { generateId } from '@/lib/utils'
import { DEFAULT_TENANT_ID } from '@/lib/supabase/config'
import { fetchAll, insertRow, updateRow, deleteRow } from '@/lib/supabase/repo'

interface PromotionStore {
  promotions: Promotion[]
  loaded: boolean
  fetch: () => Promise<void>
  addPromotion: (values: PromotionFormValues) => Promotion
  updatePromotion: (id: string, values: PromotionFormValues) => void
  deletePromotion: (id: string) => void
  toggleActive: (id: string) => void
  /** Tambah penggunaan promo (dipanggil saat checkout pakai kode promo) */
  recordPromoUse: (id: string) => void
}

export const usePromotionStore = create<PromotionStore>()((set, get) => ({
  promotions: mockPromotions,
  loaded: false,

  fetch: async () => {
    const rows = await fetchAll<Promotion>('promotions', 'created_at', false)
    if (rows) set({ promotions: rows, loaded: true })
    else set({ loaded: true })
  },

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
    set((s) => ({ promotions: [newPromotion, ...s.promotions] }))
    void insertRow<Promotion>('promotions', {
      tenant_id: DEFAULT_TENANT_ID,
      name: newPromotion.name,
      type: newPromotion.type,
      value: newPromotion.value,
      min_purchase: newPromotion.min_purchase || null,
      code: newPromotion.code || null,
      max_uses: newPromotion.max_uses || null,
      used_count: 0,
      starts_at: newPromotion.starts_at,
      ends_at: newPromotion.ends_at,
      is_active: newPromotion.is_active,
    }).then((saved) => {
      if (saved) set((s) => ({ promotions: s.promotions.map((p) => (p.id === newPromotion.id ? saved : p)) }))
    })
    return newPromotion
  },

  updatePromotion: (id, values) => {
    set((s) => ({
      promotions: s.promotions.map((p) =>
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
    }))
    void updateRow('promotions', id, {
      name: values.name,
      type: values.type,
      value: values.value,
      min_purchase: values.min_purchase || null,
      code: values.code || null,
      max_uses: values.max_uses || null,
      starts_at: values.starts_at,
      ends_at: values.ends_at,
      is_active: values.is_active,
    })
  },

  deletePromotion: (id) => {
    set((s) => ({ promotions: s.promotions.filter((p) => p.id !== id) }))
    void deleteRow('promotions', id)
  },

  toggleActive: (id) => {
    const promo = get().promotions.find((p) => p.id === id)
    if (!promo) return
    const next = !promo.is_active
    set((s) => ({ promotions: s.promotions.map((p) => (p.id === id ? { ...p, is_active: next } : p)) }))
    void updateRow('promotions', id, { is_active: next })
  },

  recordPromoUse: (id) => {
    let used = 0
    set((s) => ({
      promotions: s.promotions.map((p) => {
        if (p.id !== id) return p
        used = p.used_count + 1
        return { ...p, used_count: used }
      }),
    }))
    void updateRow('promotions', id, { used_count: used })
  },
}))

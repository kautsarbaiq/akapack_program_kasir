import { create } from 'zustand'
import type { Category } from '@/types'
import type { CategoryFormValues } from '@/lib/validations'
import { mockCategories } from '@/lib/mock-data'
import { generateId } from '@/lib/utils'
import { DEFAULT_TENANT_ID, DEFAULT_OUTLET_ID, isSupabaseConfigured } from '@/lib/supabase/config'
import { getSupabaseBrowser } from '@/lib/supabase/client'
import { fetchAll, insertRow, updateRow, deleteRow } from '@/lib/supabase/repo'

const CAT_COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#EF4444', '#06B6D4', '#EC4899', '#F97316', '#14B8A6', '#6366F1']

interface CategoryStore {
  categories: Category[]
  loaded: boolean
  fetch: () => Promise<void>
  addCategory: (values: CategoryFormValues) => Category
  updateCategory: (id: string, values: CategoryFormValues) => void
  deleteCategory: (id: string) => void
  /** Pastikan kategori (by nama) ada; buat yang belum ada. Kembalikan map namaLower→id (uuid di DB mode). */
  ensureCategories: (names: string[]) => Promise<Map<string, string>>
}

export const useCategoryStore = create<CategoryStore>()((set, get) => ({
  categories: isSupabaseConfigured() ? [] : mockCategories,
  loaded: false,

  fetch: async () => {
    const rows = await fetchAll<Category>('categories', 'sort_order', true)
    if (rows) set({ categories: rows, loaded: true })
    else set({ loaded: true })
  },

  addCategory: (values) => {
    const newCategory: Category = {
      id: generateId('cat'),
      outlet_id: DEFAULT_OUTLET_ID,
      name: values.name,
      color: values.color,
      icon: values.icon,
      sort_order: get().categories.length + 1,
      product_count: 0,
      is_active: values.is_active,
      created_at: new Date().toISOString(),
    }
    set((s) => ({ categories: [...s.categories, newCategory] }))
    void insertRow<Category>('categories', {
      tenant_id: DEFAULT_TENANT_ID,
      name: newCategory.name,
      color: newCategory.color,
      icon: newCategory.icon,
      sort_order: newCategory.sort_order,
      is_active: newCategory.is_active,
    }).then((saved) => {
      if (saved) set((s) => ({ categories: s.categories.map((c) => (c.id === newCategory.id ? { ...saved, product_count: c.product_count } : c)) }))
    })
    return newCategory
  },

  updateCategory: (id, values) => {
    set((s) => ({ categories: s.categories.map((c) => (c.id === id ? { ...c, ...values } : c)) }))
    void updateRow('categories', id, { name: values.name, color: values.color, icon: values.icon, is_active: values.is_active })
  },

  deleteCategory: (id) => {
    set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }))
    void deleteRow('categories', id)
  },

  ensureCategories: async (names) => {
    const norm = (n: string) => n.trim().toLowerCase()
    const map = new Map<string, string>()
    for (const c of get().categories) map.set(norm(c.name), c.id)
    // Nama unik yang belum ada (buang kosong)
    const want: string[] = []
    const seen = new Set<string>()
    for (const raw of names) {
      const name = raw.trim()
      if (!name) continue
      const key = norm(name)
      if (map.has(key) || seen.has(key)) continue
      seen.add(key)
      want.push(name)
    }
    if (want.length === 0) return map

    const baseOrder = get().categories.length
    const newCats: Category[] = want.map((name, i) => ({
      id: generateId('cat'),
      outlet_id: DEFAULT_OUTLET_ID,
      name,
      color: CAT_COLORS[(baseOrder + i) % CAT_COLORS.length],
      icon: 'Package',
      sort_order: baseOrder + i + 1,
      product_count: 0,
      is_active: true,
      created_at: new Date().toISOString(),
    }))
    set((s) => ({ categories: [...s.categories, ...newCats] }))
    newCats.forEach((c) => map.set(norm(c.name), c.id))

    if (!isSupabaseConfigured()) return map
    // Batch insert ke DB; korelasi balik by nama → tukar id sementara ke uuid
    const sb = getSupabaseBrowser()
    try {
      const payload = newCats.map((c) => ({
        tenant_id: DEFAULT_TENANT_ID, name: c.name, color: c.color, icon: c.icon, sort_order: c.sort_order, is_active: c.is_active,
      }))
      const { data, error } = await sb.from('categories').insert(payload).select()
      if (error || !data) { if (error) console.warn('[akapack] ensureCategories:', error.message) }
      else {
        const byName = new Map((data as Category[]).map((d) => [norm(d.name), d]))
        const remap = new Map<string, Category>()
        newCats.forEach((temp) => {
          const saved = byName.get(norm(temp.name))
          if (saved) { remap.set(temp.id, saved); map.set(norm(saved.name), saved.id) }
        })
        set((s) => ({ categories: s.categories.map((c) => (remap.get(c.id) ? { ...remap.get(c.id)!, product_count: c.product_count } : c)) }))
      }
    } catch (e) { console.warn('[akapack] ensureCategories:', e) }
    return map
  },
}))

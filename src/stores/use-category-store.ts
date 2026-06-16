import { create } from 'zustand'
import type { Category } from '@/types'
import type { CategoryFormValues } from '@/lib/validations'
import { mockCategories } from '@/lib/mock-data'
import { generateId } from '@/lib/utils'
import { DEFAULT_TENANT_ID } from '@/lib/supabase/config'
import { fetchAll, insertRow, updateRow, deleteRow } from '@/lib/supabase/repo'

interface CategoryStore {
  categories: Category[]
  loaded: boolean
  fetch: () => Promise<void>
  addCategory: (values: CategoryFormValues) => Category
  updateCategory: (id: string, values: CategoryFormValues) => void
  deleteCategory: (id: string) => void
}

export const useCategoryStore = create<CategoryStore>()((set, get) => ({
  categories: mockCategories,
  loaded: false,

  fetch: async () => {
    const rows = await fetchAll<Category>('categories', 'sort_order', true)
    if (rows) set({ categories: rows, loaded: true })
    else set({ loaded: true })
  },

  addCategory: (values) => {
    const newCategory: Category = {
      id: generateId('cat'),
      outlet_id: 'outlet-1',
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
}))

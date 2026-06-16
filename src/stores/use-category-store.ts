import { create } from 'zustand'
import type { Category } from '@/types'
import type { CategoryFormValues } from '@/lib/validations'
import { mockCategories } from '@/lib/mock-data'
import { generateId } from '@/lib/utils'

interface CategoryStore {
  categories: Category[]
  addCategory: (values: CategoryFormValues) => Category
  updateCategory: (id: string, values: CategoryFormValues) => void
  deleteCategory: (id: string) => void
}

export const useCategoryStore = create<CategoryStore>()((set, get) => ({
  categories: mockCategories,

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
    set((state) => ({ categories: [...state.categories, newCategory] }))
    return newCategory
  },

  updateCategory: (id, values) =>
    set((state) => ({
      categories: state.categories.map((c) =>
        c.id === id ? { ...c, ...values } : c
      ),
    })),

  deleteCategory: (id) =>
    set((state) => ({ categories: state.categories.filter((c) => c.id !== id) })),
}))

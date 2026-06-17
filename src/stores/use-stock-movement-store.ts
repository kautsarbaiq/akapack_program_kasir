import { create } from 'zustand'
import type { StockMovement, MovementType } from '@/types'
import { mockStockMovements } from '@/lib/mock-data'
import { generateId } from '@/lib/utils'
import { DEFAULT_TENANT_ID } from '@/lib/supabase/config'
import { fetchAll, insertRow } from '@/lib/supabase/repo'
import { useProductStore } from './use-product-store'
import { useActiveOutletStore } from './use-active-outlet-store'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (s?: string | null): s is string => !!s && UUID_RE.test(s)

interface AddMovementInput {
  product_id: string
  type: MovementType
  quantity: number
  before_stock: number
  after_stock: number
  notes?: string
  reference_id?: string
  created_by_name?: string
  outlet_id?: string // default: outlet aktif
}

interface StockMovementStore {
  movements: StockMovement[]
  loaded: boolean
  fetch: () => Promise<void>
  addMovement: (input: AddMovementInput) => void
}

export const useStockMovementStore = create<StockMovementStore>()((set) => ({
  movements: mockStockMovements,
  loaded: false,

  fetch: async () => {
    const rows = await fetchAll<StockMovement>('stock_movements', 'created_at', false)
    if (rows) {
      const products = useProductStore.getState().products
      const withProduct = rows.map((m) => ({
        ...m,
        product: products.find((p) => p.id === m.product_id),
        created_by_name: m.created_by_name ?? 'Sistem',
      }))
      set({ movements: withProduct, loaded: true })
    } else {
      set({ loaded: true })
    }
  },

  addMovement: (input) => {
    const product = useProductStore.getState().products.find((p) => p.id === input.product_id)
    const outletId = input.outlet_id ?? useActiveOutletStore.getState().activeOutletId
    const mv: StockMovement = {
      id: generateId('mov'),
      outlet_id: outletId,
      product_id: input.product_id,
      product,
      type: input.type,
      quantity: input.quantity,
      before_stock: input.before_stock,
      after_stock: input.after_stock,
      notes: input.notes,
      reference_id: input.reference_id,
      created_by: 'system',
      created_by_name: input.created_by_name ?? 'Sistem',
      created_at: new Date().toISOString(),
    }
    set((s) => ({ movements: [mv, ...s.movements] }))
    void insertRow('stock_movements', {
      tenant_id: DEFAULT_TENANT_ID,
      outlet_id: isUuid(outletId) ? outletId : null,
      product_id: isUuid(input.product_id) ? input.product_id : null,
      type: input.type,
      quantity: input.quantity,
      before_stock: input.before_stock,
      after_stock: input.after_stock,
      notes: input.notes ?? null,
      reference_id: isUuid(input.reference_id) ? input.reference_id : null,
    })
  },
}))

import { create } from 'zustand'
import { mockProducts } from '@/lib/mock-data'
import { generateId } from '@/lib/utils'
import { DEFAULT_OUTLET_ID, isSupabaseConfigured } from '@/lib/supabase/config'
import { fetchAll } from '@/lib/supabase/repo'
import {
  enqueueStock, applyStockNow as sendNow, pendingStockLines, registerStockSyncHandlers, flushStockOutbox,
  describeStockError, type StockLine, type StockResult, type StockFailure,
} from '@/lib/stock/stock-sync'
import { useStockMovementStore } from './use-stock-movement-store'

export interface InventoryRow {
  id: string
  outlet_id: string
  product_id: string
  variant_id?: string
  stock: number
  min_stock: number
}

interface InventoryRowDB {
  id: string
  outlet_id: string
  product_id: string
  variant_id: string | null
  stock: number | null
  min_stock: number | null
}

// Seed dari stok mock ke outlet Pusat (mock mode). Di DB mode digantikan fetch().
const seedRows: InventoryRow[] = mockProducts.map((p) => ({
  id: `inv-${p.id}`,
  outlet_id: DEFAULT_OUTLET_ID,
  product_id: p.id,
  stock: p.stock,
  min_stock: p.min_stock,
}))

const matches = (r: InventoryRow, outletId: string, productId: string, variantId?: string | null) =>
  r.outlet_id === outletId && r.product_id === productId && (variantId ? r.variant_id === variantId : !r.variant_id)

const rowKey = (outletId: string, productId: string, variantId?: string | null) => `${outletId}|${productId}|${variantId ?? ''}`
const lineKey = (l: StockLine) => rowKey(l.outlet_id, l.product_id, l.variant_id)

/** Terapkan baris ke sebuah angka: set_to menimpa, delta menambah (urutan penting). */
function fold(start: number, lines: StockLine[]): number {
  let v = start
  for (const l of lines) v = l.set_to != null ? Math.max(0, Math.round(l.set_to)) : v + Math.round(l.delta ?? 0)
  return v
}

/** Pemberitahuan ke store lain (produk/varian) bahwa angka stok berubah → proyeksikan ulang. */
const reconciledListeners = new Set<() => void>()
export function onStockReconciled(cb: () => void) { reconciledListeners.add(cb); return () => reconciledListeners.delete(cb) }
function emitReconciled() { reconciledListeners.forEach((cb) => { try { cb() } catch { /* abaikan */ } }) }

export interface Estimate { before: number; after: number }

interface InventoryStore {
  items: InventoryRow[]
  loaded: boolean
  /** Baris perubahan stok yang masih di antrean perangkat (belum sampai server). */
  pendingLines: number
  fetch: () => Promise<void>
  /** Stok di outlet tsb. null = inventory belum dimuat sama sekali → pemanggil pakai fallback lama. */
  stockAt: (outletId: string, productId: string, variantId?: string) => number | null
  minStockAt: (outletId: string, productId: string, variantId?: string) => number | null
  /**
   * Ubah stok — TAHAN OFFLINE. Baris ditulis ke antrean perangkat dulu, dikirim ke server yang
   * mengubah stok + menulis riwayat dalam satu transaksi. Mengembalikan PERKIRAAN sebelum/sesudah
   * per baris (dari memori); angka server menyusul dan otomatis menggantikannya.
   */
  applyStock: (lines: StockLine[]) => Estimate[]
  /**
   * Ubah stok dan TUNGGU server (impor, opname, ubah dari form) — pengguna butuh hasil/penolakan
   * seketika (mis. STOK_BERUBAH). Tidak masuk antrean; yang gagal dilaporkan per baris.
   */
  applyStockNow: (lines: StockLine[]) => Promise<{ results: StockResult[]; failed: StockFailure[] }>
  /** Saat produk baru tersimpan (id sementara → uuid), pindahkan baris memori ke id barunya. */
  remapProduct: (oldProductId: string, newProductId: string) => void
  /** Saat varian baru tersimpan (id sementara → uuid), pindahkan baris memori ke id barunya. */
  remapVariant: (oldVariantId: string, newVariantId: string) => void
  /** Hapus baris inventory milik produk (saat produk dihapus). */
  removeProduct: (productId: string) => void
  /** Hapus baris inventory milik outlet (saat outlet dihapus). */
  removeByOutlet: (outletId: string) => void
  /** Kosongkan semua baris inventory di memori (saat hapus semua produk; DB ikut via cascade FK). */
  clearAll: () => void
}

export const useInventoryStore = create<InventoryStore>()((set, get) => {
  /** Ubah memori saja (optimistis) — dipakai applyStock & applyStockNow. */
  const applyLocal = (lines: StockLine[]): Estimate[] => {
    const items = get().items.slice()
    const est: Estimate[] = []
    for (const l of lines) {
      const idx = items.findIndex((r) => matches(r, l.outlet_id, l.product_id, l.variant_id))
      const before = idx >= 0 ? items[idx].stock : 0
      const after = fold(before, [l])
      if (idx >= 0) items[idx] = { ...items[idx], stock: after }
      else items.push({ id: generateId('inv'), outlet_id: l.outlet_id, product_id: l.product_id, variant_id: l.variant_id ?? undefined, stock: after, min_stock: 0 })
      est.push({ before, after })
    }
    set({ items })
    return est
  }

  /**
   * Samakan memori dengan server untuk baris-baris yang disentuh: angka server terakhir untuk
   * baris itu + baris yang MASIH di antrean (belum terkirim) untuk baris yang sama.
   */
  const reconcile = (truth: Map<string, number>) => {
    if (!truth.size) return
    const pending = pendingStockLines()
    const items = get().items.slice()
    truth.forEach((serverAfter, key) => {
      const [o, p, v] = key.split('|')
      const later = pending.filter((l) => lineKey(l) === key)
      const value = fold(serverAfter, later)
      const idx = items.findIndex((r) => matches(r, o, p, v || undefined))
      if (idx >= 0) items[idx] = { ...items[idx], stock: value }
      else items.push({ id: generateId('inv'), outlet_id: o, product_id: p, variant_id: v || undefined, stock: value, min_stock: 0 })
    })
    set({ items })
    emitReconciled()
  }

  registerStockSyncHandlers({
    onQueueChange: (pending) => set({ pendingLines: pending }),
    onApplied: (lines, results) => {
      const byId = new Map(results.map((r) => [r.movement_id, r]))
      const truth = new Map<string, number>()
      // Baris diterapkan server dalam urutan kunci; untuk tiap baris stok, yang terakhir = angka terkini.
      for (const r of results) {
        const line = lines.find((l) => l.id === r.movement_id)
        if (!line || !r.applied) continue // applied=false = kiriman ulang → angkanya historis, bukan terkini
        truth.set(lineKey(line), r.after_stock)
      }
      reconcile(truth)
      useStockMovementStore.getState().resolvePending(lines.map((l) => {
        const r = byId.get(l.id)
        return r ? { id: l.id, before: r.before_stock, after: r.after_stock, quantity: r.quantity } : null
      }).filter(Boolean) as { id: string; before: number; after: number; quantity: number }[])
    },
    onRejected: (lines, code, message, interactive) => {
      // Ditolak permanen → batalkan efek optimisnya di memori dan riwayat, lalu beri tahu.
      const items = get().items.slice()
      for (const l of lines) {
        if (l.set_to != null) continue // set absolut tak bisa dibalik tanpa angka lama → muat ulang di bawah
        const idx = items.findIndex((r) => matches(r, l.outlet_id, l.product_id, l.variant_id))
        if (idx >= 0) items[idx] = { ...items[idx], stock: items[idx].stock - Math.round(l.delta ?? 0) }
      }
      set({ items })
      useStockMovementStore.getState().dropPending(lines.map((l) => l.id))
      if (lines.some((l) => l.set_to != null)) void get().fetch()
      emitReconciled()
      if (!interactive && typeof window !== 'undefined') {
        void import('sonner').then(({ toast }) =>
          toast.error(`Perubahan stok DITOLAK server: ${describeStockError(code, message)}. ${lines.length} baris dibatalkan.`, { duration: 15000 })
        )
      }
    },
  })

  return {
    items: isSupabaseConfigured() ? [] : seedRows,
    loaded: false,
    pendingLines: typeof window !== 'undefined' ? pendingStockLines().length : 0,

    fetch: async () => {
      const rows = await fetchAll<InventoryRowDB>('inventory', 'created_at', true)
      if (!rows) {
        set({ loaded: true }) // tabel belum ada → pertahankan seed mock (fallback)
        return
      }
      // Angka server + perubahan yang masih di antrean perangkat ini (belum sampai server) —
      // dulu muat ulang membuang perubahan yang belum terkirim, stok "balik lagi".
      const pending = pendingStockLines()
      const mapped: InventoryRow[] = rows.map((r) => {
        const key = rowKey(r.outlet_id, r.product_id, r.variant_id)
        const mine = pending.filter((l) => lineKey(l) === key)
        return {
          id: r.id,
          outlet_id: r.outlet_id,
          product_id: r.product_id,
          variant_id: r.variant_id ?? undefined,
          stock: fold(r.stock ?? 0, mine),
          min_stock: r.min_stock ?? 0,
        }
      })
      // Baris antrean untuk kombinasi yang belum punya baris di server (stok pertama kali).
      const known = new Set(mapped.map((m) => rowKey(m.outlet_id, m.product_id, m.variant_id)))
      const extra = new Map<string, StockLine[]>()
      for (const l of pending) if (!known.has(lineKey(l))) extra.set(lineKey(l), [...(extra.get(lineKey(l)) ?? []), l])
      extra.forEach((ls, key) => {
        const [o, p, v] = key.split('|')
        mapped.push({ id: generateId('inv'), outlet_id: o, product_id: p, variant_id: v || undefined, stock: fold(0, ls), min_stock: 0 })
      })
      set({ items: mapped, loaded: true })
      emitReconciled()
      void flushStockOutbox()
    },

    stockAt: (outletId, productId, variantId) => {
      const items = get().items
      if (items.length === 0) return null
      const row = items.find((r) => matches(r, outletId, productId, variantId))
      return row ? row.stock : 0
    },

    minStockAt: (outletId, productId, variantId) => {
      const items = get().items
      if (items.length === 0) return null
      const row = items.find((r) => matches(r, outletId, productId, variantId))
      return row ? row.min_stock : 0
    },

    applyStock: (lines) => {
      const est = applyLocal(lines)
      useStockMovementStore.getState().addPending(lines, est)
      enqueueStock(lines)
      emitReconciled()
      return est
    },

    applyStockNow: async (lines) => {
      const est = applyLocal(lines)
      useStockMovementStore.getState().addPending(lines, est)
      emitReconciled()
      return sendNow(lines)
    },

    remapProduct: (oldId, newId) => {
      if (!get().items.some((r) => r.product_id === oldId)) return
      set((s) => ({ items: s.items.map((r) => (r.product_id === oldId ? { ...r, product_id: newId } : r)) }))
    },

    remapVariant: (oldId, newId) => {
      if (!get().items.some((r) => r.variant_id === oldId)) return
      set((s) => ({ items: s.items.map((r) => (r.variant_id === oldId ? { ...r, variant_id: newId } : r)) }))
    },

    removeProduct: (productId) => set((s) => ({ items: s.items.filter((r) => r.product_id !== productId) })),

    removeByOutlet: (outletId) => set((s) => ({ items: s.items.filter((r) => r.outlet_id !== outletId) })),

    clearAll: () => set({ items: [] }),
  }
})

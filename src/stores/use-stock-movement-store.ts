import { create } from 'zustand'
import type { StockMovement } from '@/types'
import { mockStockMovements } from '@/lib/mock-data'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { fetchAll } from '@/lib/supabase/repo'
import { pendingStockLines, type StockLine } from '@/lib/stock/stock-sync'
import { useProductStore } from './use-product-store'

/**
 * Riwayat pergerakan stok.
 *
 * Riwayat TIDAK lagi ditulis dari sini. Setiap perubahan stok lewat useInventoryStore.applyStock
 * → fungsi DB yang menulis stok + riwayat sekaligus dengan angka sebelum/sesudah yang sebenarnya.
 * Store ini hanya menampilkan: baris server + baris "menunggu" (masih di antrean perangkat) yang
 * diganti angka server begitu terkonfirmasi. id-nya sama, jadi muat ulang tak pernah menggandakan.
 */

/** Urutan tampilan: urutan TERAP di server dulu (applied_seq), baris lama (tanpa seq) menurut waktu. */
export function compareMovementsDesc(a: StockMovement, b: StockMovement): number {
  if (a.pending !== b.pending) return a.pending ? -1 : 1 // yang masih menunggu paling atas (paling baru)
  const sa = a.applied_seq ?? null
  const sb = b.applied_seq ?? null
  if (sa != null && sb != null && sa !== sb) return sb - sa
  if (sa != null && sb == null) return -1
  if (sa == null && sb != null) return 1
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1
  return a.id < b.id ? 1 : -1
}

function pendingRow(l: StockLine, before: number, after: number): StockMovement {
  const qty = l.set_to != null ? after - before : Math.round(l.delta ?? 0)
  return {
    id: l.id,
    outlet_id: l.outlet_id,
    product_id: l.product_id,
    variant_id: l.variant_id ?? null,
    product: useProductStore.getState().products.find((p) => p.id === l.product_id),
    type: l.type,
    quantity: qty,
    before_stock: before,
    after_stock: after,
    notes: l.notes,
    reference_id: l.reference_id ?? undefined,
    created_by: 'system',
    created_at: l.created_at ?? new Date().toISOString(),
    applied_seq: null,
    pending: true,
  }
}

interface StockMovementStore {
  movements: StockMovement[]
  loaded: boolean
  /** Muat sekali saat halaman pemakainya dibuka (lazy — hemat bandwidth saat boot). */
  ensure: () => void
  /** Paksa muat ulang (halaman History dibuka) — perubahan dari perangkat lain ikut tampil. */
  refresh: () => Promise<void>
  fetch: () => Promise<void>
  /** Tampilkan baris yang baru dikirim (perkiraan) — dipanggil useInventoryStore.applyStock. */
  addPending: (lines: StockLine[], estimates: { before: number; after: number }[]) => void
  /** Server mengonfirmasi → ganti perkiraan dengan angka sebenarnya. */
  resolvePending: (rows: { id: string; before: number; after: number; quantity: number }[]) => void
  /** Ditolak server → hapus baris perkiraannya. */
  dropPending: (ids: string[]) => void
  /** Kosongkan semua pergerakan stok di memori (saat hapus semua produk; DB ikut via cascade FK). */
  clearAll: () => void
}

let __fetching: Promise<void> | null = null
// Nomor urut sementara untuk baris yang baru dikonfirmasi (server tak mengembalikan applied_seq-nya):
// diletakkan paling atas (paling baru) sampai muat ulang mengganti dengan nomor sebenarnya.
let provisionalSeq = Number.MAX_SAFE_INTEGER
// Kapan baris lokal dikonfirmasi server — muat ulang yang dimulai SEBELUM itu bisa belum memuatnya,
// jadi baris tsb dipertahankan alih-alih hilang dari tampilan.
const resolvedAt = new Map<string, number>()
export const useStockMovementStore = create<StockMovementStore>()((set, get) => ({
  movements: isSupabaseConfigured() ? [] : mockStockMovements,
  loaded: false,

  ensure: () => { if (!get().loaded) void get().fetch() },

  refresh: () => get().fetch(),

  fetch: async () => {
    if (__fetching) return __fetching
    const run = (async () => {
      const startedAt = Date.now()
      const rows = await fetchAll<StockMovement>('stock_movements', 'created_at', false)
      if (!rows) { set({ loaded: true }); return }
      const products = useProductStore.getState().products
      const byId = new Map(products.map((p) => [p.id, p]))
      const server = rows.map((m) => ({ ...m, product: byId.get(m.product_id), pending: false }))
      const ids = new Set(server.map((m) => m.id))
      // Pertahankan baris lokal yang belum ada di potret server:
      //  - masih di antrean perangkat ("menunggu sinyal"), atau sedang dikirim langsung (applyStockNow);
      //  - sudah dikonfirmasi server SETELAH muat ulang ini dimulai (potretnya belum memuatnya).
      const queued = new Set(pendingStockLines().map((l) => l.id))
      const keep = get().movements.filter((m) => !ids.has(m.id) && (
        (m.pending && (queued.has(m.id) || !resolvedAt.has(m.id))) ||
        (resolvedAt.get(m.id) ?? 0) >= startedAt
      ))
      for (const id of ids) resolvedAt.delete(id)
      set({ movements: [...keep, ...server].sort(compareMovementsDesc), loaded: true })
    })()
    __fetching = run.finally(() => { __fetching = null })
    return __fetching
  },

  addPending: (lines, estimates) => {
    const rows = lines.map((l, i) => pendingRow(l, estimates[i]?.before ?? 0, estimates[i]?.after ?? 0))
    const ids = new Set(rows.map((r) => r.id))
    set((s) => ({ movements: [...rows, ...s.movements.filter((m) => !ids.has(m.id))] }))
  },

  resolvePending: (rows) => {
    if (!rows.length) return
    const byId = new Map(rows.map((r) => [r.id, r]))
    set((s) => ({
      movements: s.movements.map((m) => {
        const r = byId.get(m.id)
        if (!r) return m
        resolvedAt.set(m.id, Date.now())
        return { ...m, before_stock: r.before, after_stock: r.after, quantity: r.quantity, pending: false, applied_seq: provisionalSeq-- }
      }),
    }))
  },

  dropPending: (ids) => {
    ids.forEach((id) => resolvedAt.delete(id))
    const drop = new Set(ids)
    set((s) => ({ movements: s.movements.filter((m) => !(m.pending && drop.has(m.id))) }))
  },

  clearAll: () => set({ movements: [] }),
}))

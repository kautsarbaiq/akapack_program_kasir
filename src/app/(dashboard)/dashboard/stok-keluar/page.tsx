'use client'

import { useState, useMemo } from 'react'
import { PackageMinus, Plus, Eye, X, Send, Trash2, Printer } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ProductCombobox } from '@/components/dashboard/product-combobox'
import { StockOutDocument, REASON_LABEL } from '@/components/dashboard/stockout-document'
import { useStockOutStore } from '@/stores/use-stockout-store'
import { useProductStore } from '@/stores/use-product-store'
import { useVariantStore } from '@/stores/use-variant-store'
import { useInventoryStore } from '@/stores/use-inventory-store'
import { useOutletStore } from '@/stores/use-outlet-store'
import { useActiveOutletStore } from '@/stores/use-active-outlet-store'
import { useStockMovementStore } from '@/stores/use-stock-movement-store'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { formatRupiah, formatDate, generateId, localDay } from '@/lib/utils'
import type { StockOut, StockOutItem, StockOutStatus, StockOutReason } from '@/types'
import { toast } from 'sonner'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isPending = (d: StockOut) => isSupabaseConfigured() && !UUID_RE.test(d.id)

const STATUS: Record<StockOutStatus, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  posted: { label: 'Posted', cls: 'bg-red-100 text-red-700 border-red-200' },
  cancelled: { label: 'Batal', cls: 'bg-gray-100 text-gray-400 border-gray-200' },
}
const REASONS: StockOutReason[] = ['rusak', 'hilang', 'pemakaian', 'retur', 'penyesuaian', 'lainnya']

// Nomor urut harian dari MAX yang ada (bukan acak) → tak bentrok. Pakai tanggal lokal.
function genNo(existing: { number: string }[]) {
  const ymd = localDay(new Date()).replace(/-/g, '')
  const prefix = `OUT-${ymd}-`
  const max = existing.reduce((mx, d) => {
    if (!d.number?.startsWith(prefix)) return mx
    const n = parseInt(d.number.slice(prefix.length), 10)
    return Number.isNaN(n) ? mx : Math.max(mx, n)
  }, 0)
  return `${prefix}${String(max + 1).padStart(3, '0')}`
}

type DraftItem = { product_id: string; qty: number }

export default function StokKeluarPage() {
  const stockOuts = useStockOutStore((s) => s.stockOuts)
  const addStockOut = useStockOutStore((s) => s.addStockOut)
  const setStatus = useStockOutStore((s) => s.setStatus)
  const deleteStockOut = useStockOutStore((s) => s.deleteStockOut)
  const products = useProductStore((s) => s.products)
  const outlets = useOutletStore((s) => s.outlets)
  const activeOutletId = useActiveOutletStore((s) => s.activeOutletId)
  const addMovement = useStockMovementStore((s) => s.addMovement)

  const [filter, setFilter] = useState<'all' | StockOutStatus>('all')
  const [detail, setDetail] = useState<StockOut | null>(null)
  const [open, setOpen] = useState(false)

  // form
  const [outletId, setOutletId] = useState(activeOutletId)
  const [reason, setReason] = useState<StockOutReason>('rusak')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<DraftItem[]>([{ product_id: '', qty: 1 }])

  const filtered = useMemo(() => (filter === 'all' ? stockOuts : stockOuts.filter((d) => d.status === filter)), [stockOuts, filter])
  const posted = stockOuts.filter((d) => d.status === 'posted')
  const totalValue = posted.reduce((s, d) => s + d.total, 0)

  const stockOf = (pid: string) => useInventoryStore.getState().stockAt(outletId, pid) ?? products.find((p) => p.id === pid)?.stock ?? 0
  const costOf = (pid: string) => products.find((p) => p.id === pid)?.cost_price ?? 0
  const formTotal = items.reduce((s, i) => s + (i.qty || 0) * costOf(i.product_id), 0)

  const setItem = (idx: number, patch: Partial<DraftItem>) => setItems((ls) => ls.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  const addItem = () => setItems((ls) => [...ls, { product_id: '', qty: 1 }])
  const removeItem = (idx: number) => setItems((ls) => (ls.length <= 1 ? ls : ls.filter((_, i) => i !== idx)))

  const openNew = () => {
    setOutletId(activeOutletId); setReason('rusak'); setDate(new Date().toISOString().slice(0, 10)); setNotes('')
    setItems([{ product_id: '', qty: 1 }]); setOpen(true)
  }

  const create = () => {
    const valid = items.filter((i) => i.product_id && i.qty > 0)
    if (!valid.length) { toast.error('Tambah minimal 1 produk dengan qty > 0'); return }
    // gabung qty bila produk sama dipilih dua kali
    const merged = new Map<string, number>()
    for (const i of valid) merged.set(i.product_id, (merged.get(i.product_id) ?? 0) + i.qty)
    const docId = generateId('out')
    const docItems: StockOutItem[] = [...merged.entries()].map(([pid, qty]) => {
      const prod = products.find((p) => p.id === pid)
      const cost = prod?.cost_price ?? 0
      return { id: generateId('outi'), stock_out_id: docId, product_id: pid, product_name: prod?.name ?? '-', qty, cost, subtotal: qty * cost }
    })
    const doc: StockOut = {
      id: docId, number: genNo(stockOuts), outlet_id: outletId, reason,
      items: docItems, total: docItems.reduce((s, i) => s + i.subtotal, 0), total_qty: docItems.reduce((s, i) => s + i.qty, 0),
      status: 'draft', notes: notes.trim() || undefined,
      date: new Date(date).toISOString(), created_at: new Date().toISOString(),
    }
    addStockOut(doc)
    toast.success(`Dokumen ${doc.number} dibuat (draft) — posting untuk mengurangi stok`)
    setOpen(false)
  }

  const refreshProjection = (oid: string) => {
    if (oid === activeOutletId) {
      useProductStore.getState().projectStock(activeOutletId)
      useVariantStore.getState().projectVariantStock(activeOutletId)
    }
  }

  const post = (doc: StockOut) => {
    const live = useStockOutStore.getState().stockOuts.find((d) => d.id === doc.id)
    if (!live || live.status !== 'draft') return
    const inv = useInventoryStore.getState()
    // Tolak posting bila ada qty > stok tersedia — kalau dibiarkan, stok di-clamp ke 0 tapi
    // movement mencatat qty penuh, dan MENGHAPUS dokumen itu mengembalikan qty penuh = stok hantu.
    const short = live.items.find((it) => {
      const avail = inv.stockAt(live.outlet_id, it.product_id) ?? products.find((p) => p.id === it.product_id)?.stock ?? 0
      return it.qty > avail
    })
    if (short) {
      toast.error(`Stok ${short.product_name} tidak cukup (butuh ${short.qty}). Sesuaikan qty dokumen dulu.`)
      return
    }
    live.items.forEach((it) => {
      const before = inv.stockAt(live.outlet_id, it.product_id) ?? 0
      const { after } = inv.applyDelta(live.outlet_id, it.product_id, undefined, -it.qty)
      addMovement({ product_id: it.product_id, type: 'out', quantity: -it.qty, before_stock: before, after_stock: after, notes: `Stok keluar ${live.number} (${REASON_LABEL[live.reason]})`, reference_id: live.id, created_by_name: 'Stok Keluar', outlet_id: live.outlet_id })
    })
    refreshProjection(live.outlet_id)
    setStatus(live.id, 'posted', new Date().toISOString())
    toast.success('Dokumen diposting — stok berkurang & pergerakan tercatat')
    setDetail(null)
  }

  const cancelDoc = (doc: StockOut) => {
    if (confirm(`Batalkan dokumen ${doc.number}?`)) { setStatus(doc.id, 'cancelled'); toast.success('Dokumen dibatalkan'); setDetail(null) }
  }

  const remove = (doc: StockOut) => {
    const wasPosted = doc.status === 'posted'
    if (!confirm(`Hapus dokumen ${doc.number}?${wasPosted ? ' Stok yang sudah keluar akan dikembalikan.' : ''}`)) return
    if (wasPosted) {
      const inv = useInventoryStore.getState()
      doc.items.forEach((it) => {
        const before = inv.stockAt(doc.outlet_id, it.product_id) ?? 0
        const { after } = inv.applyDelta(doc.outlet_id, it.product_id, undefined, it.qty)
        addMovement({ product_id: it.product_id, type: 'in', quantity: it.qty, before_stock: before, after_stock: after, notes: `Hapus stok keluar ${doc.number}`, reference_id: doc.id, created_by_name: 'Stok Keluar', outlet_id: doc.outlet_id })
      })
      refreshProjection(doc.outlet_id)
    }
    deleteStockOut(doc.id)
    toast.success('Dokumen dihapus')
    setDetail(null)
  }

  const handlePrint = () => { if (typeof window !== 'undefined') window.print() }

  const FILTERS: { value: 'all' | StockOutStatus; label: string }[] = [
    { value: 'all', label: 'Semua' }, { value: 'draft', label: 'Draft' }, { value: 'posted', label: 'Posted' }, { value: 'cancelled', label: 'Batal' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><PackageMinus size={22} /> Stok Keluar</h1>
          <p className="text-muted-foreground text-sm mt-1">Dokumen pengeluaran stok per tanggal (rusak, hilang, pemakaian, retur). Posting mengurangi stok & bisa dicetak.</p>
        </div>
        <Button onClick={openNew} className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"><Plus size={16} /> Buat Stok Keluar</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{stockOuts.length}</p><p className="text-xs text-muted-foreground mt-0.5">Total Dokumen</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{posted.length}</p><p className="text-xs text-muted-foreground mt-0.5">Sudah Posted</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold text-red-600">{formatRupiah(totalValue)}</p><p className="text-xs text-muted-foreground mt-0.5">Nilai Modal Keluar</p></CardContent></Card>
      </div>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <Button key={f.value} size="sm" variant={filter === f.value ? 'default' : 'outline'}
            className={`text-xs ${filter === f.value ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}`}
            onClick={() => setFilter(f.value)}>{f.label}</Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50" style={{ borderBottom: '1px solid var(--border)' }}>
                  {['No. Dokumen', 'Outlet', 'Alasan', 'Item', 'Nilai', 'Tanggal', 'Status', 'Aksi'].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const st = STATUS[d.status]
                  const oname = outlets.find((o) => o.id === d.outlet_id)?.name ?? '-'
                  return (
                    <tr key={d.id} className="hover:bg-muted/30" style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="py-3 px-4 font-mono text-xs font-semibold">{d.number}</td>
                      <td className="py-3 px-4 text-xs">{oname}</td>
                      <td className="py-3 px-4 text-xs">{REASON_LABEL[d.reason]}</td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">{d.items.length} item · {d.total_qty} qty</td>
                      <td className="py-3 px-4 font-bold">{formatRupiah(d.total)}</td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">{formatDate(d.date)}</td>
                      <td className="py-3 px-4"><Badge variant="outline" className={`text-xs ${st.cls}`}>{st.label}</Badge></td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetail(d)}><Eye size={13} /></Button>
                          {d.status === 'draft' && (
                            <Button size="sm" disabled={isPending(d)} className="h-7 text-xs bg-red-600 text-white hover:bg-red-700 gap-1" onClick={() => post(d)}><Send size={12} /> {isPending(d) ? 'Menyimpan…' : 'Posting'}</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="py-16 text-center"><PackageMinus size={36} className="mx-auto text-muted-foreground mb-2" /><p className="text-muted-foreground">Belum ada dokumen stok keluar</p></div>}
          </div>
        </CardContent>
      </Card>

      {/* Detail — dokumen (bisa dicetak) */}
      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent showCloseButton={false} className="sm:max-w-3xl max-h-[92vh] overflow-y-auto p-0 gap-0">
          {detail && (
            <>
              <div className="flex items-center justify-between gap-2 px-5 py-3 border-b sticky top-0 bg-background z-10 print:hidden">
                <div className="flex items-center gap-2 min-w-0">
                  <PackageMinus size={17} className="shrink-0" />
                  <span className="font-mono font-semibold text-sm truncate">{detail.number}</span>
                  <Badge variant="outline" className={`text-xs ${STATUS[detail.status].cls}`}>{STATUS[detail.status].label}</Badge>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {detail.status === 'draft' && (
                    <>
                      <Button size="sm" disabled={isPending(detail)} className="h-8 gap-1.5 bg-red-600 text-white hover:bg-red-700" onClick={() => post(detail)}><Send size={14} /> Posting</Button>
                      <Button size="sm" variant="outline" disabled={isPending(detail)} className="h-8 gap-1.5" onClick={() => cancelDoc(detail)}><X size={14} /> Batal</Button>
                    </>
                  )}
                  <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={handlePrint}><Printer size={14} /> Cetak</Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive" disabled={isPending(detail)} onClick={() => remove(detail)}><Trash2 size={14} /></Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setDetail(null)}><X size={15} /></Button>
                </div>
              </div>
              {detail.status === 'posted' && (
                <p className="px-5 py-2 text-xs text-red-700 bg-red-50 border-b print:hidden">Dokumen sudah <b>Posted</b> — stok sudah berkurang. Untuk koreksi, hapus dokumen (stok dikembalikan).</p>
              )}
              {isPending(detail) && <p className="px-5 py-2 text-xs text-amber-600 print:hidden">Menyimpan dokumen… tunggu sebentar sebelum memposting.</p>}
              <div className="p-5 bg-muted/20">
                <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
                  <StockOutDocument doc={detail} />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Buat Stok Keluar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Buat Dokumen Stok Keluar</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Outlet</Label>
                <select value={outletId} onChange={(e) => setOutletId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Alasan</Label>
                <select value={reason} onChange={(e) => setReason(e.target.value as StockOutReason)} className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  {REASONS.map((r) => <option key={r} value={r}>{REASON_LABEL[r]}</option>)}
                </select>
              </div>
              <div className="space-y-2"><Label>Tanggal</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center text-xs font-semibold text-muted-foreground px-1">
                <span className="flex-1">Produk</span><span className="w-24 text-right">Stok</span><span className="w-20 text-right">Qty</span><span className="w-28 text-right">Nilai</span><span className="w-8" />
              </div>
              {items.map((it, i) => {
                const avail = it.product_id ? stockOf(it.product_id) : null
                const over = avail !== null && it.qty > avail
                return (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex-1"><ProductCombobox products={products} value={it.product_id} onChange={(pid) => setItem(i, { product_id: pid })} /></div>
                    <span className={`w-24 text-right text-xs tabular-nums ${over ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>{avail === null ? '—' : avail}</span>
                    <Input type="number" min={1} className={`w-20 text-right ${over ? 'border-red-400' : ''}`} value={it.qty || ''} onChange={(e) => setItem(i, { qty: Math.max(0, Number(e.target.value) || 0) })} />
                    <span className="w-28 text-right text-sm tabular-nums">{formatRupiah((it.qty || 0) * costOf(it.product_id))}</span>
                    <button type="button" onClick={() => removeItem(i)} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-destructive disabled:opacity-30" disabled={items.length <= 1}><X size={14} /></button>
                  </div>
                )
              })}
              <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs" onClick={addItem}><Plus size={13} /> Tambah Produk</Button>
              {items.some((it) => it.product_id && it.qty > stockOf(it.product_id)) && (
                <p className="text-xs text-amber-600">Ada qty melebihi stok tersedia — stok akan dibatasi minimum 0 saat posting.</p>
              )}
            </div>

            <div className="flex justify-end items-end">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Total Nilai Modal</p>
                <p className="text-xl font-bold tabular-nums">{formatRupiah(formTotal)}</p>
              </div>
            </div>
            <div className="space-y-2"><Label>Catatan (opsional)</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={create} className="bg-primary text-primary-foreground hover:bg-primary/90">Buat Dokumen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

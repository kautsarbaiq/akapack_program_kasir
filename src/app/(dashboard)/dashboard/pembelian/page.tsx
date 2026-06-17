'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ShoppingCart, Plus, Truck, Eye, X, PackageCheck, BadgeCheck, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { usePurchaseStore } from '@/stores/use-purchase-store'
import { useSupplierStore } from '@/stores/use-supplier-store'
import { useProductStore } from '@/stores/use-product-store'
import { useStockMovementStore } from '@/stores/use-stock-movement-store'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { formatRupiah, formatDate, generateId } from '@/lib/utils'
import type { PurchaseOrder, PurchaseItem, PurchaseStatus, PurchasePayment } from '@/types'
import { toast } from 'sonner'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// PO yang baru dibuat masih id sementara sampai insert Supabase selesai — kunci aksi sampai persist.
const isPending = (po: PurchaseOrder) => isSupabaseConfigured() && !UUID_RE.test(po.id)

const STATUS: Record<PurchaseStatus, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  ordered: { label: 'Dipesan', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  received: { label: 'Diterima', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Batal', cls: 'bg-red-100 text-red-700 border-red-200' },
}
const PAYMENT: Record<PurchasePayment, string> = { cash: 'Tunai', transfer: 'Transfer', credit: 'Tempo (Hutang)' }

function genPO() {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `PO-${ymd}-${Math.floor(Math.random() * 900 + 100)}`
}

type DraftItem = { product_id: string; qty: number; cost: number }

export default function PembelianPage() {
  const purchases = usePurchaseStore((s) => s.purchases)
  const addPurchase = usePurchaseStore((s) => s.addPurchase)
  const setStatus = usePurchaseStore((s) => s.setStatus)
  const setPaid = usePurchaseStore((s) => s.setPaid)
  const deletePurchase = usePurchaseStore((s) => s.deletePurchase)
  const suppliers = useSupplierStore((s) => s.suppliers)
  const products = useProductStore((s) => s.products)
  const incrementStock = useProductStore((s) => s.incrementStock)
  const decrementStock = useProductStore((s) => s.decrementStock)
  const setCostPrice = useProductStore((s) => s.setCostPrice)
  const addMovement = useStockMovementStore((s) => s.addMovement)

  const [filter, setFilter] = useState<'all' | PurchaseStatus>('all')
  const [detail, setDetail] = useState<PurchaseOrder | null>(null)
  const [open, setOpen] = useState(false)

  // form PO
  const [supplierId, setSupplierId] = useState('')
  const [payment, setPayment] = useState<PurchasePayment>('credit')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<DraftItem[]>([{ product_id: '', qty: 1, cost: 0 }])

  const filtered = useMemo(() => (filter === 'all' ? purchases : purchases.filter((p) => p.status === filter)), [purchases, filter])
  const received = purchases.filter((p) => p.status === 'received')
  const hutang = received.filter((p) => p.payment === 'credit' && !p.paid).reduce((s, p) => s + p.total, 0)
  const formTotal = items.reduce((s, i) => s + (i.qty || 0) * (i.cost || 0), 0)

  const setItem = (idx: number, patch: Partial<DraftItem>) => setItems((ls) => ls.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  const onPickProduct = (idx: number, pid: string) => {
    const prod = products.find((p) => p.id === pid)
    setItem(idx, { product_id: pid, cost: prod ? prod.cost_price : 0 })
  }
  const addItem = () => setItems((ls) => [...ls, { product_id: '', qty: 1, cost: 0 }])
  const removeItem = (idx: number) => setItems((ls) => (ls.length <= 1 ? ls : ls.filter((_, i) => i !== idx)))

  const openNew = () => {
    setSupplierId(''); setPayment('credit'); setDate(new Date().toISOString().slice(0, 10)); setNotes('')
    setItems([{ product_id: '', qty: 1, cost: 0 }]); setOpen(true)
  }

  const create = () => {
    const valid = items.filter((i) => i.product_id && i.qty > 0 && i.cost > 0)
    if (!valid.length) { toast.error('Tambah minimal 1 item dengan qty & harga beli > 0'); return }
    const poId = generateId('po')
    const poItems: PurchaseItem[] = valid.map((i) => {
      const prod = products.find((p) => p.id === i.product_id)
      return { id: generateId('poi'), purchase_id: poId, product_id: i.product_id, product_name: prod?.name ?? '-', qty: i.qty, cost: i.cost, subtotal: i.qty * i.cost }
    })
    const supplier = suppliers.find((s) => s.id === supplierId)
    const po: PurchaseOrder = {
      id: poId, number: genPO(), supplier_id: supplierId || undefined, supplier,
      items: poItems, total: poItems.reduce((s, i) => s + i.subtotal, 0),
      status: 'ordered', payment, paid: false, notes: notes.trim() || undefined,
      date: new Date(date).toISOString(), created_at: new Date().toISOString(),
    }
    addPurchase(po)
    toast.success(`PO ${po.number} dibuat`)
    setOpen(false)
  }

  const receive = (po: PurchaseOrder) => {
    // Re-cek status TERKINI dari store (cegah double-receive dari objek/Sheet basi).
    const live = usePurchaseStore.getState().purchases.find((p) => p.id === po.id)
    if (!live || live.status === 'received') return
    live.items.forEach((it) => {
      const prod = useProductStore.getState().products.find((p) => p.id === it.product_id) // baca live per-iterasi
      const before = prod?.stock ?? 0
      // Moving-average cost agar nilai Persediaan (masuk) konsisten dgn HPP (keluar)
      if (prod && it.cost > 0) {
        const denom = before + it.qty
        setCostPrice(it.product_id, denom > 0 ? Math.round((before * prod.cost_price + it.qty * it.cost) / denom) : it.cost)
      }
      incrementStock(it.product_id, it.qty)
      addMovement({ product_id: it.product_id, type: 'in', quantity: it.qty, before_stock: before, after_stock: before + it.qty, notes: `Pembelian ${live.number}`, reference_id: live.id, created_by_name: 'Pembelian' })
    })
    setStatus(live.id, 'received', new Date().toISOString())
    toast.success('Barang diterima — stok bertambah & jurnal tercatat')
    setDetail(null)
  }

  const markPaid = (po: PurchaseOrder) => { setPaid(po.id, true, new Date().toISOString()); toast.success('Hutang ditandai lunas'); setDetail(null) }

  const cancelOrder = (po: PurchaseOrder) => {
    if (confirm(`Batalkan PO ${po.number}?`)) { setStatus(po.id, 'cancelled'); toast.success('PO dibatalkan'); setDetail(null) }
  }

  const remove = (po: PurchaseOrder) => {
    const wasReceived = po.status === 'received'
    if (!confirm(`Hapus PO ${po.number}?${wasReceived ? ' Stok yang sudah masuk akan dikembalikan.' : ''}`)) return
    if (wasReceived) {
      po.items.forEach((it) => {
        const prod = useProductStore.getState().products.find((p) => p.id === it.product_id)
        const before = prod?.stock ?? 0
        decrementStock(it.product_id, it.qty)
        addMovement({ product_id: it.product_id, type: 'out', quantity: -it.qty, before_stock: before, after_stock: Math.max(0, before - it.qty), notes: `Hapus PO ${po.number}`, reference_id: po.id, created_by_name: 'Pembelian' })
      })
    }
    deletePurchase(po.id)
    toast.success('PO dihapus')
    setDetail(null)
  }

  const FILTERS: { value: 'all' | PurchaseStatus; label: string }[] = [
    { value: 'all', label: 'Semua' }, { value: 'ordered', label: 'Dipesan' }, { value: 'received', label: 'Diterima' }, { value: 'cancelled', label: 'Batal' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ShoppingCart size={22} /> Pembelian</h1>
          <p className="text-muted-foreground text-sm mt-1">Purchase Order ke supplier — terima barang menambah stok & mencatat hutang otomatis</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/pembelian/supplier"><Button variant="outline" className="gap-1.5"><Truck size={16} /> Supplier</Button></Link>
          <Button onClick={openNew} className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"><Plus size={16} /> Buat PO</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{purchases.length}</p><p className="text-xs text-muted-foreground mt-0.5">Total PO</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{received.length}</p><p className="text-xs text-muted-foreground mt-0.5">Sudah Diterima</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold text-amber-600">{formatRupiah(hutang)}</p><p className="text-xs text-muted-foreground mt-0.5">Hutang Belum Lunas</p></CardContent></Card>
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
                  {['No. PO', 'Supplier', 'Item', 'Total', 'Bayar', 'Tanggal', 'Status', 'Aksi'].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const st = STATUS[p.status]
                  return (
                    <tr key={p.id} className="hover:bg-muted/30" style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="py-3 px-4 font-mono text-xs font-semibold">{p.number}</td>
                      <td className="py-3 px-4">{p.supplier?.name ?? '-'}</td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">{p.items.length} item</td>
                      <td className="py-3 px-4 font-bold">{formatRupiah(p.total)}</td>
                      <td className="py-3 px-4 text-xs">{PAYMENT[p.payment]}{p.payment === 'credit' && p.status === 'received' && (p.paid ? ' ✓' : ' ·belum')}</td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">{formatDate(p.date)}</td>
                      <td className="py-3 px-4"><Badge variant="outline" className={`text-xs ${st.cls}`}>{st.label}</Badge></td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetail(p)}><Eye size={13} /></Button>
                          {(p.status === 'ordered' || p.status === 'draft') && (
                            <Button size="sm" disabled={isPending(p)} className="h-7 text-xs bg-emerald-600 text-white hover:bg-emerald-700 gap-1" onClick={() => receive(p)}><PackageCheck size={12} /> {isPending(p) ? 'Menyimpan…' : 'Terima'}</Button>
                          )}
                          {p.status === 'received' && p.payment === 'credit' && !p.paid && (
                            <Button size="sm" variant="outline" disabled={isPending(p)} className="h-7 text-xs gap-1" onClick={() => markPaid(p)}><BadgeCheck size={12} /> Lunas</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="py-16 text-center"><ShoppingCart size={36} className="mx-auto text-muted-foreground mb-2" /><p className="text-muted-foreground">Belum ada PO</p></div>}
          </div>
        </CardContent>
      </Card>

      {/* Detail */}
      <Sheet open={!!detail} onOpenChange={() => setDetail(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {detail && (
            <>
              <SheetHeader className="pb-4"><SheetTitle className="flex items-center gap-2"><ShoppingCart size={18} /> {detail.number}</SheetTitle></SheetHeader>
              <div className="space-y-5">
                <div className="rounded-xl p-4 bg-muted/50 text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Supplier</span><span className="font-medium">{detail.supplier?.name ?? '-'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Pembayaran</span><span>{PAYMENT[detail.payment]}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span>{STATUS[detail.status].label}</span></div>
                  {detail.notes && <p className="text-xs text-muted-foreground pt-1">{detail.notes}</p>}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Item</p>
                  {detail.items.map((it) => (
                    <div key={it.id} className="flex justify-between text-sm py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
                      <span>{it.product_name} × {it.qty} @ {formatRupiah(it.cost)}</span>
                      <span className="font-semibold">{formatRupiah(it.subtotal)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold pt-1"><span>Total</span><span>{formatRupiah(detail.total)}</span></div>
                </div>
                {isPending(detail) && <p className="text-xs text-amber-600">Menyimpan PO… tunggu sebentar sebelum memproses.</p>}
                <div className="flex gap-2 flex-wrap">
                  {(detail.status === 'ordered' || detail.status === 'draft') && (
                    <>
                      <Button disabled={isPending(detail)} className="flex-1 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => receive(detail)}><PackageCheck size={15} /> Terima Barang</Button>
                      <Button variant="outline" disabled={isPending(detail)} className="gap-1.5" onClick={() => cancelOrder(detail)}><X size={15} /> Batal</Button>
                    </>
                  )}
                  {detail.status === 'received' && detail.payment === 'credit' && !detail.paid && (
                    <Button variant="outline" disabled={isPending(detail)} className="flex-1 gap-1.5" onClick={() => markPaid(detail)}><BadgeCheck size={15} /> Tandai Lunas</Button>
                  )}
                  <Button variant="outline" disabled={isPending(detail)} className="text-destructive hover:text-destructive gap-1.5" onClick={() => remove(detail)}><Trash2 size={15} /> Hapus</Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Dialog Buat PO */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Buat Purchase Order</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Supplier</Label>
                <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">— pilih supplier —</option>
                  {suppliers.filter((s) => s.is_active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-2"><Label>Tanggal</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center text-xs font-semibold text-muted-foreground px-1">
                <span className="flex-1">Produk</span><span className="w-20 text-right">Qty</span><span className="w-28 text-right">Harga Beli</span><span className="w-24 text-right">Subtotal</span><span className="w-8" />
              </div>
              {items.map((it, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select value={it.product_id} onChange={(e) => onPickProduct(i, e.target.value)} className="flex-1 h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">— pilih produk —</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <Input type="number" min={1} className="w-20 text-right" value={it.qty || ''} onChange={(e) => setItem(i, { qty: Math.max(0, Number(e.target.value)) })} />
                  <Input type="number" min={0} className="w-28 text-right" value={it.cost || ''} onChange={(e) => setItem(i, { cost: Math.max(0, Number(e.target.value)) })} />
                  <span className="w-24 text-right text-sm tabular-nums">{formatRupiah((it.qty || 0) * (it.cost || 0))}</span>
                  <button type="button" onClick={() => removeItem(i)} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-destructive disabled:opacity-30" disabled={items.length <= 1}><X size={14} /></button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs" onClick={addItem}><Plus size={13} /> Tambah Produk</Button>
            </div>

            <div className="grid grid-cols-2 gap-3 items-end">
              <div className="space-y-2">
                <Label>Pembayaran</Label>
                <select value={payment} onChange={(e) => setPayment(e.target.value as PurchasePayment)} className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="credit">Tempo (Hutang Usaha)</option>
                  <option value="cash">Tunai (Kas)</option>
                  <option value="transfer">Transfer (Bank)</option>
                </select>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Total PO</p>
                <p className="text-xl font-bold tabular-nums">{formatRupiah(formTotal)}</p>
              </div>
            </div>
            <div className="space-y-2"><Label>Catatan (opsional)</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={create} className="bg-primary text-primary-foreground hover:bg-primary/90">Buat PO</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

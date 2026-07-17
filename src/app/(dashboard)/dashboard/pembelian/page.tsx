'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { PackagePlus, Plus, Truck, X, PackageCheck, Trash2, Printer, Download, Upload, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { PurchaseDocument } from '@/components/dashboard/purchase-document'
import { ImportStokMasukDialog } from '@/components/dashboard/import-stok-masuk-dialog'
import { ProductCombobox } from '@/components/dashboard/product-combobox'
import { usePurchaseStore } from '@/stores/use-purchase-store'
import { useSupplierStore } from '@/stores/use-supplier-store'
import { useProductStore } from '@/stores/use-product-store'
import { useStockMovementStore } from '@/stores/use-stock-movement-store'
import { useCurrentUserStore } from '@/stores/use-current-user-store'
import { useActiveOutletStore } from '@/stores/use-active-outlet-store'
import { useInventoryStore } from '@/stores/use-inventory-store'
import { useOutletStore } from '@/stores/use-outlet-store'
import { OutletFilter } from '@/components/dashboard/outlet-filter'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { formatRupiah, formatDate, generateId, localDay, rankedSearch } from '@/lib/utils'
import type { PurchaseOrder, PurchaseItem, PurchaseStatus } from '@/types'
import { toast } from 'sonner'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isPending = (po: PurchaseOrder) => isSupabaseConfigured() && !UUID_RE.test(po.id)

// Olsera: 'ordered'/'draft' = Draft (belum posting), 'received' = Posted (stok masuk)
const STATUS: Record<PurchaseStatus, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  ordered: { label: 'Draft', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  received: { label: 'Posted', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Batal', cls: 'bg-red-100 text-red-700 border-red-200' },
}

/** Nomor dokumen gaya Olsera: IN + YYMMDD + urutan 8 digit. */
function genIN(dateStr: string, seq: number) {
  const d = new Date(dateStr)
  const yy = String(d.getFullYear()).slice(-2)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `IN${yy}${mm}${dd}${String(seq).padStart(8, '0')}`
}

type DraftItem = { product_id: string; qty: number; cost: number }

export default function StokMasukPage() {
  const purchases = usePurchaseStore((s) => s.purchases)
  useEffect(() => { usePurchaseStore.getState().ensure() }, []) // lazy load: muat riwayat saat halaman dibuka (hemat egress)
  const addPurchase = usePurchaseStore((s) => s.addPurchase)
  const setStatus = usePurchaseStore((s) => s.setStatus)
  const deletePurchase = usePurchaseStore((s) => s.deletePurchase)
  const suppliers = useSupplierStore((s) => s.suppliers)
  const products = useProductStore((s) => s.products)
  const setCostPrice = useProductStore((s) => s.setCostPrice)
  const addMovement = useStockMovementStore((s) => s.addMovement)
  const currentUser = useCurrentUserStore((s) => s.user)
  const me = currentUser?.email || currentUser?.name || 'Sistem'

  const [detail, setDetail] = useState<PurchaseOrder | null>(null)
  const [open, setOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const outlets = useOutletStore((s) => s.outlets)
  const activeOutletId = useActiveOutletStore((s) => s.activeOutletId)
  const outletName = (id?: string) => outlets.find((o) => o.id === id)?.name ?? '—'

  // filter & paginasi
  const today = new Date()
  const [dateFrom, setDateFrom] = useState(`${today.getFullYear()}-01-01`)
  const [dateTo, setDateTo] = useState(localDay(today))
  const [search, setSearch] = useState('')
  const [outletFilter, setOutletFilter] = useState('all')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)

  // form
  const [formOutletId, setFormOutletId] = useState(activeOutletId) // cabang tujuan stok
  const [supplierId, setSupplierId] = useState('')
  const [receivedFrom, setReceivedFrom] = useState('')
  const [date, setDate] = useState(localDay(today))
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<DraftItem[]>([{ product_id: '', qty: 1, cost: 0 }])

  const filtered = useMemo(() => {
    const base = purchases.filter((p) => {
      const day = (p.date || '').slice(0, 10)
      if (dateFrom && day < dateFrom) return false
      if (dateTo && day > dateTo) return false
      if (outletFilter === 'none') { if (p.outlet_id) return false } // dokumen lama tanpa cabang
      else if (outletFilter !== 'all' && p.outlet_id !== outletFilter) return false
      return true
    })
    return rankedSearch(base, search, (p) => [p.number, p.received_from], (p) => p.number)
  }, [purchases, dateFrom, dateTo, search, outletFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const curPage = Math.min(page, totalPages)
  const pageRows = filtered.slice((curPage - 1) * pageSize, curPage * pageSize)
  const formTotal = items.reduce((s, i) => s + (i.qty || 0) * (i.cost || 0), 0)

  const setItem = (idx: number, patch: Partial<DraftItem>) => setItems((ls) => ls.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  const onPickProduct = (idx: number, pid: string) => {
    const prod = products.find((p) => p.id === pid)
    setItem(idx, { product_id: pid, cost: prod ? prod.cost_price : 0 })
  }
  const addItem = () => setItems((ls) => [...ls, { product_id: '', qty: 1, cost: 0 }])
  const removeItem = (idx: number) => setItems((ls) => (ls.length <= 1 ? ls : ls.filter((_, i) => i !== idx)))

  const openNew = () => {
    setFormOutletId(activeOutletId) // default cabang aktif — bisa diganti di form
    setSupplierId(''); setReceivedFrom(''); setDate(localDay(new Date())); setNotes('')
    setItems([{ product_id: '', qty: 1, cost: 0 }]); setOpen(true)
  }

  // Tambah stok + pergerakan + moving-average cost untuk dokumen yang diposting.
  // PENTING: stok masuk ke CABANG DOKUMEN (po.outlet_id), BUKAN outlet aktif — supaya
  // posting/menghapus dokumen Bandung saat sedang melihat Garut tak mengubah stok Garut.
  const applyStock = (po: PurchaseOrder) => {
    const outlet = po.outlet_id || useActiveOutletStore.getState().activeOutletId
    const inv = useInventoryStore.getState()
    po.items.forEach((it) => {
      const prod = useProductStore.getState().products.find((p) => p.id === it.product_id)
      const { before: invBefore, after: invAfter } = inv.applyDelta(outlet, it.product_id, undefined, it.qty)
      if (prod && it.cost > 0) {
        // Bobot rata-rata pakai stok lama ter-clamp ≥0 — stok MINUS (jual saat kosong) tidak boleh
        // menyeret rumus jadi bobot negatif/modal ngaco.
        const wBefore = Math.max(0, invBefore)
        const denom = wBefore + it.qty
        setCostPrice(it.product_id, denom > 0 ? Math.round((wBefore * prod.cost_price + it.qty * it.cost) / denom) : it.cost)
      }
      addMovement({ product_id: it.product_id, type: 'in', quantity: it.qty, before_stock: invBefore, after_stock: invAfter, notes: `Stok Masuk ${po.number}`, reference_id: po.id, created_by_name: me, outlet_id: outlet })
    })
    // Segarkan tampilan stok outlet aktif (kalau dokumen ini memang di outlet aktif).
    useProductStore.getState().projectStock(useActiveOutletStore.getState().activeOutletId)
  }

  const create = (postNow: boolean) => {
    const rawValid = items.filter((i) => i.product_id && i.qty > 0 && i.cost > 0)
    if (!rawValid.length) { toast.error('Tambah minimal 1 produk dengan qty & harga beli > 0'); return }
    // Gabung baris produk yang sama (sum qty, cost rata-rata tertimbang) — cegah moving-average kacau & movement ganda.
    const mergedMap = new Map<string, DraftItem>()
    for (const i of rawValid) {
      const ex = mergedMap.get(i.product_id)
      if (ex) {
        const totQty = ex.qty + i.qty
        ex.cost = totQty > 0 ? Math.round((ex.cost * ex.qty + i.cost * i.qty) / totQty) : i.cost
        ex.qty = totQty
      } else mergedMap.set(i.product_id, { ...i })
    }
    const valid = [...mergedMap.values()]
    const poId = generateId('po')
    const poItems: PurchaseItem[] = valid.map((i) => {
      const prod = products.find((p) => p.id === i.product_id)
      return { id: generateId('poi'), purchase_id: poId, product_id: i.product_id, product_name: prod?.name ?? '-', qty: i.qty, cost: i.cost, subtotal: i.qty * i.cost }
    })
    const supplier = suppliers.find((s) => s.id === supplierId)
    const now = new Date().toISOString()
    // Nomor urut dari MAX nomor yang ada (bukan panjang array) → tak bentrok walau ada yg dihapus.
    const nextSeq = purchases.reduce((mx, p) => {
      const m = /(\d{8})$/.exec(p.number || '')
      return m ? Math.max(mx, parseInt(m[1], 10)) : mx
    }, 0) + 1
    const po: PurchaseOrder = {
      id: poId, number: genIN(date, nextSeq),
      outlet_id: formOutletId, // cabang tujuan stok dipilih EKSPLISIT di form (Bandung/Garut terpisah)
      supplier_id: supplierId || undefined, supplier,
      items: poItems, total: poItems.reduce((s, i) => s + i.subtotal, 0),
      status: postNow ? 'received' : 'ordered', payment: 'credit', paid: false,
      notes: notes.trim() || undefined, received_from: receivedFrom.trim() || undefined, received_by: me,
      date: new Date(date).toISOString(), received_at: postNow ? now : undefined, created_at: now,
    }
    addPurchase(po)
    if (postNow) applyStock(po)
    toast.success(postNow ? `Stok Masuk ${po.number} diposting — stok ${outletName(formOutletId)} bertambah` : `Stok Masuk ${po.number} disimpan (draft) — cabang ${outletName(formOutletId)}`)
    setOpen(false)
  }

  const post = (po: PurchaseOrder) => {
    const live = usePurchaseStore.getState().purchases.find((p) => p.id === po.id)
    if (!live || live.status === 'received') return
    applyStock(live)
    setStatus(live.id, 'received', new Date().toISOString())
    toast.success('Dokumen diposting — stok bertambah & jurnal tercatat')
    setDetail(null)
  }

  const cancelDoc = (po: PurchaseOrder) => {
    if (confirm(`Batalkan dokumen ${po.number}?`)) { setStatus(po.id, 'cancelled'); toast.success('Dokumen dibatalkan'); setDetail(null) }
  }

  const remove = (po: PurchaseOrder) => {
    const wasPosted = po.status === 'received'
    if (!confirm(`Hapus dokumen ${po.number}?${wasPosted ? ' Stok yang sudah masuk akan dikembalikan.' : ''}`)) return
    if (wasPosted) {
      const outlet = po.outlet_id || useActiveOutletStore.getState().activeOutletId
      const inv = useInventoryStore.getState()
      po.items.forEach((it) => {
        // Kembalikan stok ke CABANG DOKUMEN, bukan outlet aktif (cegah salah cabang).
        const { before: invBefore, after: invAfter } = inv.applyDelta(outlet, it.product_id, undefined, -it.qty)
        addMovement({ product_id: it.product_id, type: 'out', quantity: -it.qty, before_stock: invBefore, after_stock: invAfter, notes: `Hapus Stok Masuk ${po.number}`, reference_id: po.id, created_by_name: me, outlet_id: outlet })
      })
      useProductStore.getState().projectStock(useActiveOutletStore.getState().activeOutletId)
    }
    deletePurchase(po.id)
    toast.success('Dokumen dihapus')
    setDetail(null)
  }

  const handlePrint = () => { if (typeof window !== 'undefined') window.print() }

  const handleExport = async () => {
    if (filtered.length === 0) { toast.error('Tidak ada data untuk diekspor'); return }
    const XLSX = await import('xlsx')
    const rows = filtered.map((p) => ({
      'No. Stok Masuk': p.number,
      'Cabang': outletName(p.outlet_id),
      'Diterima dari': p.received_from ?? '',
      'Supplier': p.supplier?.name ?? '',
      'Tanggal': formatDate(p.date),
      'Catatan': p.notes ?? '',
      'Status': STATUS[p.status].label,
      'Diterima Oleh': p.received_by ?? '',
      'Total': p.total,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'stok-masuk')
    XLSX.writeFile(wb, `stok-masuk-${localDay(new Date())}.xlsx`)
    toast.success(`${filtered.length} dokumen diekspor`)
  }

  const pageNums = useMemo(() => {
    const out: (number | '…')[] = []
    for (let i = 1; i <= totalPages; i++) {
      if (i <= 2 || i > totalPages - 2 || Math.abs(i - curPage) <= 1) out.push(i)
      else if (out[out.length - 1] !== '…') out.push('…')
    }
    return out
  }, [totalPages, curPage])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><PackagePlus size={22} /> Daftar Stok Masuk</h1>
          <p className="text-muted-foreground text-sm mt-1">{filtered.length} Stok Masuk</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 rounded-lg border px-2 h-9 text-xs">
            <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} className="h-7 w-[130px] border-0 px-1 text-xs focus-visible:ring-0" />
            <span className="text-muted-foreground">–</span>
            <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} className="h-7 w-[130px] border-0 px-1 text-xs focus-visible:ring-0" />
          </div>
          <Link href="/dashboard/pembelian/supplier"><Button variant="outline" className="gap-1.5 h-9"><Truck size={15} /> Supplier</Button></Link>
          <Button variant="outline" className="gap-1.5 h-9" onClick={handleExport}><Download size={15} /> Export</Button>
          <Button variant="outline" className="gap-1.5 h-9" onClick={() => setImportOpen(true)}><Upload size={15} /> Import</Button>
          <Button onClick={openNew} className="gap-1.5 h-9 bg-primary text-primary-foreground hover:bg-primary/90"><Plus size={15} /> Tambah</Button>
        </div>
      </div>

      {/* Toolbar: page size + search */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n} Baris</option>)}
        </select>
        <div className="flex items-center gap-2 flex-wrap">
          <OutletFilter value={outletFilter} onChange={(v) => { setOutletFilter(v); setPage(1) }} includeNone />
          <div className="relative w-72 max-w-full">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Cari No. Stok Masuk" className="pl-9 h-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
          </div>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50" style={{ borderBottom: '1px solid var(--border)' }}>
                  {['No.', 'Cabang', 'Diterima dari', 'Supplier', 'Tanggal', 'Catatan', 'Status', 'Diterima Oleh'].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30" style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="py-3 px-4">
                      <button onClick={() => setDetail(p)} className="font-mono text-xs font-semibold text-primary hover:underline">{p.number}</button>
                    </td>
                    <td className="py-3 px-4 text-xs whitespace-nowrap">{outletName(p.outlet_id)}</td>
                    <td className="py-3 px-4 text-sm">{p.received_from || '-'}</td>
                    <td className="py-3 px-4 text-sm">{p.supplier?.name ?? ''}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">{formatDate(p.date)}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground max-w-[260px]">{p.notes ?? ''}</td>
                    <td className="py-3 px-4"><Badge variant="outline" className={`text-xs ${STATUS[p.status].cls}`}>{STATUS[p.status].label}</Badge></td>
                    <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">{p.received_by ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="py-16 text-center"><PackagePlus size={36} className="mx-auto text-muted-foreground mb-2" /><p className="text-muted-foreground">Belum ada stok masuk pada rentang ini</p></div>}
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 flex-wrap">
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={curPage <= 1} onClick={() => setPage(curPage - 1)}><ChevronLeft size={16} /></Button>
          {pageNums.map((n, i) => n === '…'
            ? <span key={`e${i}`} className="px-2 text-muted-foreground">…</span>
            : <Button key={n} variant={n === curPage ? 'default' : 'ghost'} size="sm" className={`h-8 w-8 p-0 ${n === curPage ? 'bg-primary text-primary-foreground' : ''}`} onClick={() => setPage(n)}>{n}</Button>)}
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={curPage >= totalPages} onClick={() => setPage(curPage + 1)}><ChevronRight size={16} /></Button>
        </div>
      )}

      {/* Detail — dokumen Stok Masuk */}
      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent showCloseButton={false} className="sm:max-w-3xl max-h-[92vh] overflow-y-auto p-0 gap-0">
          {detail && (
            <>
              <div className="flex items-center justify-between gap-2 px-5 py-3 border-b sticky top-0 bg-background z-10 print:hidden">
                <div className="flex items-center gap-2 min-w-0">
                  <PackagePlus size={17} className="shrink-0" />
                  <span className="font-mono font-semibold text-sm truncate">{detail.number}</span>
                  <Badge variant="outline" className={`text-xs ${STATUS[detail.status].cls}`}>{STATUS[detail.status].label}</Badge>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {(detail.status === 'ordered' || detail.status === 'draft') && (
                    <>
                      <Button size="sm" disabled={isPending(detail)} className="h-8 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => post(detail)}><PackageCheck size={14} /> Posting</Button>
                      <Button size="sm" variant="outline" disabled={isPending(detail)} className="h-8 gap-1.5" onClick={() => cancelDoc(detail)}><X size={14} /> Batal</Button>
                    </>
                  )}
                  <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={handlePrint}><Printer size={14} /> Cetak</Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive" disabled={isPending(detail)} onClick={() => remove(detail)}><Trash2 size={14} /></Button>
                  <Button size="sm" variant="ghost" className="h-8 gap-1.5" onClick={() => setDetail(null)}><ChevronLeft size={14} /> Kembali</Button>
                </div>
              </div>
              <p className="px-5 py-2 text-xs bg-amber-50 text-amber-800 border-b print:hidden">Pastikan data sudah benar sebelum diposting. Setelah terposting, data tidak diperbolehkan diubah.</p>
              {isPending(detail) && <p className="px-5 py-2 text-xs text-amber-600 print:hidden">Menyimpan dokumen… tunggu sebentar sebelum memposting.</p>}
              <div className="p-5 bg-muted/20">
                <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
                  <PurchaseDocument po={detail} />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Tambah Stok Masuk */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Tambah Stok Masuk</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Cabang Tujuan Stok *</Label>
                <select value={formOutletId} onChange={(e) => setFormOutletId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring">
                  {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="space-y-2"><Label>Tanggal</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Supplier (opsional)</Label>
                <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">— tidak ada —</option>
                  {suppliers.filter((s) => s.is_active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-2"><Label>Diterima dari (opsional)</Label><Input value={receivedFrom} onChange={(e) => setReceivedFrom(e.target.value)} placeholder="mis. Toko Kemasan Garut" /></div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center text-xs font-semibold text-muted-foreground px-1">
                <span className="flex-1">Produk</span><span className="w-20 text-right">Qty</span><span className="w-28 text-right">Harga Beli</span><span className="w-24 text-right">Total</span><span className="w-8" />
              </div>
              {items.map((it, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1"><ProductCombobox products={products} value={it.product_id} onChange={(pid) => onPickProduct(i, pid)} /></div>
                  <Input type="number" min={1} className="w-20 text-right" value={it.qty || ''} onChange={(e) => setItem(i, { qty: Math.max(0, Number(e.target.value) || 0) })} />
                  <Input type="number" min={0} className="w-28 text-right" value={it.cost || ''} onChange={(e) => setItem(i, { cost: Math.max(0, Number(e.target.value) || 0) })} />
                  <span className="w-24 text-right text-sm tabular-nums">{formatRupiah((it.qty || 0) * (it.cost || 0))}</span>
                  <button type="button" onClick={() => removeItem(i)} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-destructive disabled:opacity-30" disabled={items.length <= 1}><X size={14} /></button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs" onClick={addItem}><Plus size={13} /> Tambah Produk</Button>
            </div>

            <div className="flex justify-end items-end">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-xl font-bold tabular-nums">{formatRupiah(formTotal)}</p>
              </div>
            </div>
            <div className="space-y-2"><Label>Catatan (opsional)</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="mis. Datang Barang 13 Juni 2026" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => create(false)}>Simpan Draft</Button>
            <Button onClick={() => create(true)} className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"><PackageCheck size={15} /> Simpan & Posting</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportStokMasukDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}

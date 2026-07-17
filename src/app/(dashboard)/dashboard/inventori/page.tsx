'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, XCircle, CheckCircle2, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight,
  Search, ClipboardList, Copy, Eye, Layers, Power, ScrollText, Trash2, FileSpreadsheet,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Label } from '@/components/ui/label'
import { useProductStore } from '@/stores/use-product-store'
import { useStockMovementStore } from '@/stores/use-stock-movement-store'
import { useInventoryStore } from '@/stores/use-inventory-store'
import { useActiveOutletStore } from '@/stores/use-active-outlet-store'
import { useOutletStore } from '@/stores/use-outlet-store'
import { useVariantStore } from '@/stores/use-variant-store'
import { useRole } from '@/stores/use-current-user-store'
import { ImportStokDialog } from '@/components/dashboard/import-stok-dialog'
import { ProductCombobox } from '@/components/dashboard/product-combobox'
import { formatRupiah, formatDateTime, getStockStatus, rankedSearch } from '@/lib/utils'
import type { Product } from '@/types'
import type { ProductFormValues } from '@/lib/validations'
import { toast } from 'sonner'

type StockFilter = 'all' | 'safe' | 'low' | 'out'
type Flow = { mode: 'in' | 'out'; productId: string }
const MOVE_LABEL: Record<string, string> = { in: 'Masuk', out: 'Keluar', transfer: 'Transfer', adjustment: 'Penyesuaian', opname: 'Opname' }

export default function InventoriPage() {
  const products = useProductStore((s) => s.products)
  const addProduct = useProductStore((s) => s.addProduct)
  const deleteProduct = useProductStore((s) => s.deleteProduct)
  const setActive = useProductStore((s) => s.setActive)
  const movements = useStockMovementStore((s) => s.movements)
  useEffect(() => { useStockMovementStore.getState().ensure() }, []) // lazy: muat data saat halaman dibuka (hemat egress)
  const addMovement = useStockMovementStore((s) => s.addMovement)
  const invItems = useInventoryStore((s) => s.items)
  const activeOutletId = useActiveOutletStore((s) => s.activeOutletId)
  const outlets = useOutletStore((s) => s.outlets)
  const activeOutletName = outlets.find((o) => o.id === activeOutletId)?.name ?? 'Outlet'

  const { isCashier, canSeeCost } = useRole()
  const readOnly = isCashier // karyawan: lihat-saja; manager & owner bisa input stok
  // canSeeCost (Nilai stok = modal): hanya owner

  const [search, setSearch] = useState('')
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')

  // form stok masuk/keluar
  const [flow, setFlow] = useState<Flow | null>(null)
  const [qty, setQty] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [outletId, setOutletId] = useState(activeOutletId)

  // menu klik-kanan + panel
  const [menu, setMenu] = useState<{ x: number; y: number; product: Product } | null>(null)
  const [detail, setDetail] = useState<Product | null>(null)
  const [stockOf, setStockOf] = useState<Product | null>(null)
  const [logOf, setLogOf] = useState<Product | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    return () => { window.removeEventListener('click', close); window.removeEventListener('scroll', close, true) }
  }, [menu])

  const filtered = useMemo(() => {
    const base = products.filter((p) => stockFilter === 'all' || stockFilter === getStockStatus(p.stock, p.min_stock))
    return rankedSearch(base, search, (p) => [p.name, p.sku, p.barcode], (p) => p.name)
  }, [products, search, stockFilter])

  // Batasi baris yang dirender (katalog bisa ribuan). Reset saat filter berubah.
  const [shown, setShown] = useState(100)
  useEffect(() => { setShown(100) }, [search, stockFilter])
  const visible = filtered.slice(0, shown)

  const totalValue = products.reduce((s, p) => s + p.stock * p.cost_price, 0)
  const lowCount = products.filter((p) => getStockStatus(p.stock, p.min_stock) === 'low').length
  const outCount = products.filter((p) => getStockStatus(p.stock, p.min_stock) === 'out').length

  const openFlow = (mode: 'in' | 'out', productId = '') => {
    setFlow({ mode, productId }); setQty(''); setDate(new Date().toISOString().slice(0, 10)); setNote(''); setOutletId(activeOutletId)
  }

  const submitFlow = () => {
    if (!flow) return
    const product = products.find((p) => p.id === flow.productId)
    const n = Number(qty)
    if (!product) { toast.error('Pilih produk dulu'); return }
    if (!Number.isFinite(n) || n <= 0) { toast.error('Jumlah tidak valid'); return }
    if (!note.trim()) { toast.error('Catatan wajib diisi'); return }
    if (flow.mode === 'out') {
      const avail = useInventoryStore.getState().stockAt(outletId, product.id, undefined)
      if (avail !== null && n > avail) { toast.error(`Stok di ${outlets.find((o) => o.id === outletId)?.name ?? 'outlet'} cuma ${avail}`); return }
    }
    const delta = flow.mode === 'in' ? n : -n
    const { before, after } = useInventoryStore.getState().applyDelta(outletId, product.id, undefined, delta)
    const applied = after - before // perubahan nyata (konsisten dgn clamp ≥0)
    if (applied === 0) { toast.error(flow.mode === 'out' ? 'Stok tidak mencukupi di outlet ini' : 'Tidak ada perubahan stok'); return }
    addMovement({
      product_id: product.id, type: flow.mode, quantity: applied, before_stock: before, after_stock: after,
      notes: note.trim(), date: new Date(date).toISOString(), outlet_id: outletId, created_by_name: 'Inventori',
    })
    useProductStore.getState().projectStock(activeOutletId)
    useVariantStore.getState().projectVariantStock(activeOutletId)
    const oname = outlets.find((o) => o.id === outletId)?.name ?? ''
    toast.success(`Stok ${flow.mode === 'in' ? 'masuk' : 'keluar'} ${product.name} ${flow.mode === 'in' ? '+' : '−'}${n} di ${oname}`)
    setFlow(null)
  }

  // ── aksi menu klik-kanan ──
  const duplicate = (p: Product) => {
    const values: ProductFormValues = {
      category_id: p.category_id, name: `${p.name} (Salinan)`, sku: `${p.sku}-COPY`, barcode: '', description: p.description ?? '',
      price: p.price, cost_price: p.cost_price, stock: 0, min_stock: p.min_stock, unit: p.unit, is_active: p.is_active,
    }
    addProduct(values, p.units, p.price_tiers, p.price_online)
    toast.success(`Produk disalin: ${values.name}`)
  }
  const toggleActive = (p: Product) => { setActive(p.id, !p.is_active); toast.success(`${p.name} ${!p.is_active ? 'diaktifkan' : 'dinonaktifkan'}`) }
  const remove = (p: Product) => { if (confirm(`Hapus produk "${p.name}"? Stok & inventory ikut terhapus.`)) { deleteProduct(p.id); toast.success('Produk dihapus') } }

  const StatusBadge = ({ stock, minStock }: { stock: number; minStock: number }) => {
    const s = getStockStatus(stock, minStock)
    if (s === 'out') return <Badge variant="destructive" className="text-xs gap-1"><XCircle size={10} />Habis</Badge>
    if (s === 'low') return <Badge className="text-xs gap-1 bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100"><AlertTriangle size={10} />Menipis</Badge>
    return <Badge className="text-xs gap-1 bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50"><CheckCircle2 size={10} />Aman</Badge>
  }

  const stockPerOutlet = (productId: string) => outlets.map((o) => ({
    outlet: o,
    stock: invItems.filter((r) => r.outlet_id === o.id && r.product_id === productId && !r.variant_id).reduce((s, r) => s + r.stock, 0),
  }))
  const productLog = (productId: string) => movements.filter((m) => m.product_id === productId)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Manajemen Inventori</h1>
          <p className="text-muted-foreground text-sm mt-1">Stok outlet aktif: <span className="font-medium text-foreground">{activeOutletName}</span>{readOnly ? ' · mode lihat-saja' : ' · klik-kanan baris untuk menu'}</p>
        </div>
        {!readOnly && (
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => openFlow('in')}><ArrowDownToLine size={15} /> Stok Masuk</Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-amber-700" onClick={() => openFlow('out')}><ArrowUpFromLine size={15} /> Stok Keluar</Button>
          <Link href="/dashboard/inventori/transfer"><Button size="sm" variant="outline" className="gap-1.5"><ArrowLeftRight size={15} /> Transfer</Button></Link>
          <Link href="/dashboard/inventori/opname"><Button size="sm" variant="outline" className="gap-1.5"><ClipboardList size={15} /> Opname</Button></Link>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setImportOpen(true)}><FileSpreadsheet size={15} /> Import Excel</Button>
        </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total SKU', value: products.length, color: 'text-foreground' },
          // Nilai Stok = modal (sensitif) → hanya owner
          ...(canSeeCost ? [{ label: `Nilai Stok (${activeOutletName})`, value: formatRupiah(totalValue), color: 'text-foreground', small: true }] : []),
          { label: 'Stok Menipis', value: lowCount, color: 'text-amber-600' },
          { label: 'Stok Habis', value: outCount, color: 'text-destructive' },
        ].map((s) => (
          <Card key={s.label}><CardContent className="p-4"><p className={`${s.small ? 'text-xl' : 'text-2xl'} font-bold ${s.color}`}>{s.value}</p><p className="text-xs text-muted-foreground mt-1">{s.label}</p></CardContent></Card>
        ))}
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Cari produk..." className="pl-9 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={stockFilter} onValueChange={(v) => setStockFilter(v as StockFilter)}>
          <SelectTrigger className="w-40 h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Stok</SelectItem><SelectItem value="safe">Aman</SelectItem>
            <SelectItem value="low">Menipis</SelectItem><SelectItem value="out">Habis</SelectItem>
          </SelectContent>
        </Select>
        <span className="self-center text-sm text-muted-foreground">{filtered.length} produk</span>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50" style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Produk', 'SKU', 'Kategori', 'Stok', 'Min.', 'Status', ...(canSeeCost ? ['Nilai'] : []), ''].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors" style={{ borderBottom: '1px solid var(--border)' }}
                    onContextMenu={readOnly ? undefined : (e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, product: p }) }}>
                    <td className="py-3 px-4 font-medium">{p.name}{!p.is_active && <span className="ml-1.5 text-xs text-muted-foreground">(nonaktif)</span>}</td>
                    <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{p.sku}</td>
                    <td className="py-3 px-4"><Badge variant="secondary" className="text-xs">{p.category?.name}</Badge></td>
                    <td className="py-3 px-4"><span className={`font-bold ${getStockStatus(p.stock, p.min_stock) === 'out' ? 'text-destructive' : getStockStatus(p.stock, p.min_stock) === 'low' ? 'text-amber-600' : ''}`}>{p.stock}</span><span className="text-muted-foreground text-xs"> {p.unit}</span></td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">{p.min_stock}</td>
                    <td className="py-3 px-4"><StatusBadge stock={p.stock} minStock={p.min_stock} /></td>
                    {canSeeCost && <td className="py-3 px-4 font-semibold">{formatRupiah(p.stock * p.cost_price)}</td>}
                    <td className="py-3 px-3">
                      {readOnly ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" title="Stok masuk" onClick={() => openFlow('in', p.id)}><ArrowDownToLine size={13} /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600" title="Stok keluar" onClick={() => openFlow('out', p.id)}><ArrowUpFromLine size={13} /></Button>
                      </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">Tidak ada produk</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {filtered.length > shown && (
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs text-muted-foreground">Menampilkan {shown} dari {filtered.length} produk</span>
          <Button variant="outline" size="sm" onClick={() => setShown((s) => s + 100)}>Muat lebih banyak</Button>
        </div>
      )}

      {/* Menu klik-kanan */}
      {menu && (
        <div className="fixed z-50 w-48 rounded-lg border bg-background shadow-lg py-1 text-sm" style={{ top: Math.min(menu.y, window.innerHeight - 280), left: Math.min(menu.x, window.innerWidth - 200) }} onClick={(e) => e.stopPropagation()}>
          {[
            { icon: Copy, label: 'Salin', fn: () => duplicate(menu.product) },
            { icon: Eye, label: 'Detail', fn: () => setDetail(menu.product) },
            { icon: Layers, label: 'Detail Stock', fn: () => setStockOf(menu.product) },
            { icon: ArrowDownToLine, label: 'Stok Masuk', fn: () => openFlow('in', menu.product.id) },
            { icon: ArrowUpFromLine, label: 'Stok Keluar', fn: () => openFlow('out', menu.product.id) },
            { icon: Power, label: menu.product.is_active ? 'Nonaktifkan' : 'Aktifkan', fn: () => toggleActive(menu.product) },
            { icon: ScrollText, label: 'Log', fn: () => setLogOf(menu.product) },
          ].map((m) => {
            const Icon = m.icon
            return <button key={m.label} className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-muted text-left" onClick={() => { m.fn(); setMenu(null) }}><Icon size={14} className="text-muted-foreground" /> {m.label}</button>
          })}
          <div className="my-1 border-t" />
          <button className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-muted text-left text-destructive" onClick={() => { remove(menu.product); setMenu(null) }}><Trash2 size={14} /> Hapus</button>
        </div>
      )}

      {/* Dialog Stok Masuk / Keluar */}
      <Dialog open={!!flow} onOpenChange={(o) => !o && setFlow(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2">{flow?.mode === 'in' ? <><ArrowDownToLine size={18} className="text-emerald-600" /> Stok Masuk</> : <><ArrowUpFromLine size={18} className="text-amber-600" /> Stok Keluar</>}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label>Produk</Label>
              <ProductCombobox products={products} value={flow?.productId ?? ''} onChange={(id) => setFlow((f) => (f ? { ...f, productId: id } : f))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Jumlah *</Label><Input type="number" min={1} placeholder="0" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
              <div className="space-y-2"><Label>Tanggal</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            </div>
            <div className="space-y-2">
              <Label>{flow?.mode === 'in' ? 'Diterima oleh Outlet' : 'Keluar dari Outlet'}</Label>
              <Select value={outletId} onValueChange={(v) => v && setOutletId(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Catatan *</Label><Input placeholder={flow?.mode === 'in' ? 'Mis. Restock dari supplier' : 'Mis. Rusak / hilang / pemakaian'} value={note} onChange={(e) => setNote(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFlow(null)}>Batal</Button>
            <Button onClick={submitFlow} className={flow?.mode === 'in' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-amber-600 text-white hover:bg-amber-700'}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail produk */}
      <Sheet open={!!detail} onOpenChange={() => setDetail(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {detail && (<>
            <SheetHeader className="pb-4"><SheetTitle>{detail.name}</SheetTitle></SheetHeader>
            <div className="space-y-2 text-sm">
              {[['SKU', detail.sku], ['Barcode', detail.barcode ?? '-'], ['Kategori', detail.category?.name ?? '-'], ['Satuan', detail.unit], ['Harga Jual', formatRupiah(detail.price)], ...(canSeeCost ? [['Harga Modal', formatRupiah(detail.cost_price)]] : []), ['Stok (outlet aktif)', `${detail.stock} ${detail.unit}`], ['Min. Stok', `${detail.min_stock}`], ['Status', detail.is_active ? 'Aktif' : 'Nonaktif']].map(([k, v]) => (
                <div key={k} className="flex justify-between py-1.5" style={{ borderBottom: '1px solid var(--border)' }}><span className="text-muted-foreground">{k}</span><span className="font-medium text-right">{v}</span></div>
              ))}
              {detail.description && <p className="text-xs text-muted-foreground pt-2">{detail.description}</p>}
            </div>
          </>)}
        </SheetContent>
      </Sheet>

      {/* Detail stock per outlet */}
      <Dialog open={!!stockOf} onOpenChange={() => setStockOf(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Layers size={18} /> Stok per Outlet</DialogTitle></DialogHeader>
          {stockOf && (
            <div className="space-y-1">
              <p className="text-sm font-medium mb-2">{stockOf.name}</p>
              {stockPerOutlet(stockOf.id).map(({ outlet, stock }) => (
                <div key={outlet.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/40">
                  <span className="text-sm">{outlet.name}{outlet.id === activeOutletId && <span className="ml-1.5 text-xs text-primary">(aktif)</span>}</span>
                  <span className="font-bold tabular-nums">{stock} <span className="text-xs text-muted-foreground font-normal">{stockOf.unit}</span></span>
                </div>
              ))}
              <div className="flex items-center justify-between py-2 px-3 font-bold border-t mt-1">
                <span>Total semua outlet</span>
                <span className="tabular-nums">{stockPerOutlet(stockOf.id).reduce((s, x) => s + x.stock, 0)} {stockOf.unit}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Log pergerakan produk */}
      <Sheet open={!!logOf} onOpenChange={() => setLogOf(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {logOf && (<>
            <SheetHeader className="pb-4"><SheetTitle className="flex items-center gap-2"><ScrollText size={18} /> Log Stok — {logOf.name}</SheetTitle></SheetHeader>
            <div className="space-y-2">
              {productLog(logOf.id).map((m) => (
                <div key={m.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">{MOVE_LABEL[m.type] ?? m.type}</Badge>
                    <span className={`font-bold tabular-nums ${m.quantity < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{m.quantity > 0 ? '+' : ''}{m.quantity}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
                    <span>{formatDateTime(m.created_at)}</span>
                    <span>{m.before_stock} → {m.after_stock}</span>
                  </div>
                  {m.notes && <p className="text-xs mt-1">{m.notes}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">{outlets.find((o) => o.id === m.outlet_id)?.name ?? ''} · {m.created_by_name}</p>
                </div>
              ))}
              {productLog(logOf.id).length === 0 && <p className="text-center text-sm text-muted-foreground py-10">Belum ada pergerakan</p>}
            </div>
          </>)}
        </SheetContent>
      </Sheet>

      <ImportStokDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}

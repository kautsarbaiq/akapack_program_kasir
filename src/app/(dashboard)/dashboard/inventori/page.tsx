'use client'

import { useState, useMemo } from 'react'
import { AlertTriangle, XCircle, CheckCircle2, Plus, Search } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useProductStore } from '@/stores/use-product-store'
import { formatRupiah, getStockStatus } from '@/lib/utils'
import { toast } from 'sonner'

type StockFilter = 'all' | 'safe' | 'low' | 'out'

export default function InventoriPage() {
  const products = useProductStore((s) => s.products)
  const setStock = useProductStore((s) => s.setStock)
  const [search, setSearch] = useState('')
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [addStockOpen, setAddStockOpen] = useState(false)
  const [addProductId, setAddProductId] = useState('')
  const [addQty, setAddQty] = useState('')
  const [addNote, setAddNote] = useState('')

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
      const status = getStockStatus(p.stock, p.min_stock)
      const matchStock = stockFilter === 'all' || stockFilter === status
      return matchSearch && matchStock
    })
  }, [products, search, stockFilter])

  const totalValue = products.reduce((sum, p) => sum + p.stock * p.cost_price, 0)
  const lowCount = products.filter(p => getStockStatus(p.stock, p.min_stock) === 'low').length
  const outCount = products.filter(p => getStockStatus(p.stock, p.min_stock) === 'out').length

  const handleAddStock = () => {
    const qty = Number(addQty)
    const product = products.find((p) => p.id === addProductId)
    if (!product) { toast.error('Pilih produk dulu'); return }
    if (!Number.isFinite(qty) || qty <= 0) { toast.error('Jumlah tidak valid'); return }
    setStock(product.id, product.stock + qty)
    toast.success(`Stok ${product.name} +${qty} → ${product.stock + qty} ${product.unit}`)
    setAddStockOpen(false)
    setAddProductId('')
    setAddQty('')
    setAddNote('')
  }

  const StockStatusBadge = ({ stock, minStock }: { stock: number; minStock: number }) => {
    const s = getStockStatus(stock, minStock)
    if (s === 'out') return <Badge variant="destructive" className="text-xs gap-1"><XCircle size={10} />Habis</Badge>
    if (s === 'low') return <Badge className="text-xs gap-1 bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100"><AlertTriangle size={10} />Menipis</Badge>
    return <Badge className="text-xs gap-1 bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50"><CheckCircle2 size={10} />Aman</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Manajemen Inventori</h1>
          <p className="text-muted-foreground text-sm mt-1">Monitor dan kelola stok produk Anda</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">Stock Opname</Button>
          <Button size="sm" className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => { setAddProductId(''); setAddStockOpen(true) }}>
            <Plus size={15} /> Tambah Stok
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total SKU', value: products.length, color: 'text-foreground' },
          { label: 'Nilai Stok', value: formatRupiah(totalValue), color: 'text-foreground', small: true },
          { label: 'Stok Menipis', value: lowCount, color: 'text-amber-600' },
          { label: 'Stok Habis', value: outCount, color: 'text-destructive' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className={`${s.small ? 'text-xl' : 'text-2xl'} font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Cari produk..." className="pl-9 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={stockFilter} onValueChange={(v) => setStockFilter(v as StockFilter)}>
          <SelectTrigger className="w-40 h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Stok</SelectItem>
            <SelectItem value="safe">Aman</SelectItem>
            <SelectItem value="low">Menipis</SelectItem>
            <SelectItem value="out">Habis</SelectItem>
          </SelectContent>
        </Select>
        <span className="self-center text-sm text-muted-foreground">{filtered.length} produk</span>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50" style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Produk', 'SKU', 'Kategori', 'Stok Saat Ini', 'Min. Stok', 'Status', 'Nilai Stok', 'Aksi'].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors" style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="py-3 px-4 font-medium">{p.name}</td>
                    <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{p.sku}</td>
                    <td className="py-3 px-4"><Badge variant="secondary" className="text-xs">{p.category?.name}</Badge></td>
                    <td className="py-3 px-4">
                      <span className={`font-bold ${getStockStatus(p.stock, p.min_stock) === 'out' ? 'text-destructive' : getStockStatus(p.stock, p.min_stock) === 'low' ? 'text-amber-600' : 'text-foreground'}`}>
                        {p.stock}
                      </span>
                      <span className="text-muted-foreground text-xs"> {p.unit}</span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-sm">{p.min_stock} {p.unit}</td>
                    <td className="py-3 px-4"><StockStatusBadge stock={p.stock} minStock={p.min_stock} /></td>
                    <td className="py-3 px-4 font-semibold">{formatRupiah(p.stock * p.cost_price)}</td>
                    <td className="py-3 px-4">
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                        onClick={() => { setAddProductId(p.id); setAddStockOpen(true) }}>
                        <Plus size={12} /> Stok
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Stock Dialog */}
      <Dialog open={addStockOpen} onOpenChange={setAddStockOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Stok</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Produk</Label>
              <Select value={addProductId} onValueChange={(v) => { if (v) setAddProductId(v) }}>
                <SelectTrigger><SelectValue placeholder="Pilih produk..." /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} (stok: {p.stock})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Jumlah Tambah *</Label>
              <Input type="number" placeholder="0" min={1} value={addQty} onChange={(e) => setAddQty(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Input placeholder="Contoh: Restock dari supplier" value={addNote} onChange={(e) => setAddNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddStockOpen(false)}>Batal</Button>
            <Button onClick={handleAddStock} className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={!addQty || !addProductId}>
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

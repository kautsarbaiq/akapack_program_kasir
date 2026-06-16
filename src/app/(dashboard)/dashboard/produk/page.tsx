'use client'

import { useState, useMemo } from 'react'
import {
  Package, Plus, Search, LayoutGrid, List,
  Pencil, Trash2, AlertTriangle, CheckCircle2, XCircle,
  Download, Upload
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { useProductStore } from '@/stores/use-product-store'
import { useCategoryStore } from '@/stores/use-category-store'
import { ProductFormDialog } from '@/components/dashboard/product-form-dialog'
import { formatRupiah, getStockStatus } from '@/lib/utils'
import type { Product } from '@/types'
import { toast } from 'sonner'

type ViewMode = 'table' | 'grid'
type FilterStatus = 'all' | 'active' | 'inactive'
type FilterStock = 'all' | 'safe' | 'low' | 'out'

export default function ProdukPage() {
  const products = useProductStore((s) => s.products)
  const removeProduct = useProductStore((s) => s.deleteProduct)
  const categories = useCategoryStore((s) => s.categories)

  const [view, setView] = useState<ViewMode>('table')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')
  const [stockFilter, setStockFilter] = useState<FilterStock>('all')
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Product | null>(null)

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
      const matchCategory = categoryFilter === 'all' || p.category_id === categoryFilter
      const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? p.is_active : !p.is_active)
      const stockStatus = getStockStatus(p.stock, p.min_stock)
      const matchStock = stockFilter === 'all' || stockFilter === stockStatus
      return matchSearch && matchCategory && matchStatus && matchStock
    })
  }, [products, search, categoryFilter, statusFilter, stockFilter])

  const stats = {
    total: products.length,
    active: products.filter(p => p.is_active).length,
    low: products.filter(p => getStockStatus(p.stock, p.min_stock) === 'low').length,
    out: products.filter(p => getStockStatus(p.stock, p.min_stock) === 'out').length,
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    removeProduct(deleteTarget.id)
    toast.success(`Produk "${deleteTarget.name}" berhasil dihapus`)
    setDeleteTarget(null)
  }

  const StockBadge = ({ stock, minStock }: { stock: number; minStock: number }) => {
    const status = getStockStatus(stock, minStock)
    if (status === 'out') return <Badge variant="destructive" className="text-xs gap-1"><XCircle size={10} />Habis</Badge>
    if (status === 'low') return <Badge className="text-xs gap-1 bg-amber-100 text-amber-700 border-amber-200"><AlertTriangle size={10} />{stock} sisa</Badge>
    return <Badge className="text-xs gap-1 bg-emerald-50 text-emerald-700 border-emerald-200"><CheckCircle2 size={10} />{stock}</Badge>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Katalog Produk</h1>
          <p className="text-muted-foreground text-sm mt-1">Kelola semua produk dan stok Anda</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Upload size={14} /> Import
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Download size={14} /> Export
          </Button>
          <Button size="sm" className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => { setEditTarget(null); setFormOpen(true) }}>
            <Plus size={15} /> Tambah Produk
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Produk', value: stats.total, color: 'text-foreground' },
          { label: 'Produk Aktif', value: stats.active, color: 'text-emerald-600' },
          { label: 'Stok Menipis', value: stats.low, color: 'text-amber-600' },
          { label: 'Stok Habis', value: stats.out, color: 'text-destructive' },
        ].map((s) => (
          <Card key={s.label} className="py-0">
            <CardContent className="p-4">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Cari nama, SKU, barcode..." className="pl-9 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? 'all')}>
          <SelectTrigger className="w-44 h-9 text-sm">
            <SelectValue placeholder="Semua Kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kategori</SelectItem>
            {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as FilterStatus)}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="active">Aktif</SelectItem>
            <SelectItem value="inactive">Non-aktif</SelectItem>
          </SelectContent>
        </Select>
        <Select value={stockFilter} onValueChange={(v) => setStockFilter(v as FilterStock)}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <SelectValue placeholder="Stok" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Stok</SelectItem>
            <SelectItem value="safe">Aman</SelectItem>
            <SelectItem value="low">Menipis</SelectItem>
            <SelectItem value="out">Habis</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex border rounded-lg overflow-hidden">
          <button onClick={() => setView('table')} className={`px-3 py-1.5 text-sm transition-colors ${view === 'table' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
            <List size={15} />
          </button>
          <button onClick={() => setView('grid')} className={`px-3 py-1.5 text-sm transition-colors ${view === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
            <LayoutGrid size={15} />
          </button>
        </div>
        <span className="text-sm text-muted-foreground">{filtered.length} produk</span>
      </div>

      {/* Table View */}
      {view === 'table' && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50" style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Produk', 'Kategori', 'Harga Jual', 'HPP', 'Stok', 'Status', 'Aksi'].map((h) => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors" style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-muted">
                            <Package size={16} className="text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{p.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{p.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="secondary" className="text-xs">{p.category?.name}</Badge>
                      </td>
                      <td className="py-3 px-4 font-semibold">{formatRupiah(p.price)}</td>
                      <td className="py-3 px-4 text-muted-foreground">{formatRupiah(p.cost_price)}</td>
                      <td className="py-3 px-4">
                        <StockBadge stock={p.stock} minStock={p.min_stock} />
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={p.is_active ? 'default' : 'secondary'} className={`text-xs ${p.is_active ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : ''}`}>
                          {p.is_active ? 'Aktif' : 'Non-aktif'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => { setEditTarget(p); setFormOpen(true) }}>
                            <Pencil size={13} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(p)}>
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="py-16 text-center">
                  <Package size={40} className="mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">Tidak ada produk ditemukan</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grid View */}
      {view === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filtered.map((p) => {
            return (
              <Card key={p.id} className="overflow-hidden group cursor-pointer hover:shadow-md transition-all duration-200">
                <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                  {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : <Package size={32} className="text-muted-foreground" />}
                </div>
                <CardContent className="p-3 space-y-1.5">
                  <p className="text-sm font-semibold truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{p.sku}</p>
                  <p className="text-sm font-bold" style={{ color: 'oklch(0.55 0.22 264)' }}>{formatRupiah(p.price)}</p>
                  <div className="flex items-center justify-between">
                    <StockBadge stock={p.stock} minStock={p.min_stock} />
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1 rounded hover:bg-muted" onClick={() => { setEditTarget(p); setFormOpen(true) }}><Pencil size={12} /></button>
                      <button className="p-1 rounded hover:bg-muted text-destructive" onClick={() => setDeleteTarget(p)}><Trash2 size={12} /></button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Produk?</AlertDialogTitle>
            <AlertDialogDescription>
              Produk <strong>&ldquo;{deleteTarget?.name}&rdquo;</strong> akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ProductFormDialog open={formOpen} onOpenChange={setFormOpen} product={editTarget} />
    </div>
  )
}

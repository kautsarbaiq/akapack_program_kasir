'use client'

import { useState, useMemo } from 'react'
import { Plus, Search, Pencil, Trash2, Grid3x3, List } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useCategoryStore } from '@/stores/use-category-store'
import { CategoryFormDialog } from '@/components/dashboard/category-form-dialog'
import type { Category } from '@/types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export default function KategoriPage() {
  const categories = useCategoryStore((s) => s.categories)
  const removeCategory = useCategoryStore((s) => s.deleteCategory)
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Category | null>(null)

  const filtered = useMemo(() =>
    categories.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()))
  , [categories, search])

  const handleDelete = () => {
    if (!deleteTarget) return
    removeCategory(deleteTarget.id)
    toast.success(`Kategori "${deleteTarget.name}" dihapus`)
    setDeleteTarget(null)
  }

  const totalProducts = categories.reduce((s, c) => s + (c.product_count ?? 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kategori Produk</h1>
          <p className="text-muted-foreground text-sm mt-1">{categories.length} kategori · {totalProducts} total produk</p>
        </div>
        <Button size="sm" className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => { setEditTarget(null); setFormOpen(true) }}>
          <Plus size={15} /> Tambah Kategori
        </Button>
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Cari kategori..." className="pl-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex rounded-lg border overflow-hidden">
          <Button variant="ghost" size="sm" className={cn('rounded-none h-9 px-3', view === 'grid' && 'bg-muted')}
            onClick={() => setView('grid')}><Grid3x3 size={15} /></Button>
          <Button variant="ghost" size="sm" className={cn('rounded-none h-9 px-3', view === 'list' && 'bg-muted')}
            onClick={() => setView('list')}><List size={15} /></Button>
        </div>
      </div>

      {/* Grid View */}
      {view === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {filtered.map(cat => (
            <Card key={cat.id} className="group overflow-hidden hover:shadow-md transition-all duration-200">
              <div className="h-1.5" style={{ background: cat.color ?? '#3B82F6' }} />
              <CardContent className="p-4 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center text-2xl"
                  style={{ background: `${cat.color ?? '#3B82F6'}20` }}>
                  {cat.icon ?? '📦'}
                </div>
                <p className="font-semibold text-sm">{cat.name}</p>
                <Badge variant="secondary" className="text-xs">{cat.product_count ?? 0} produk</Badge>
                <div className="flex gap-1 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => { setEditTarget(cat); setFormOpen(true) }}>
                    <Pencil size={12} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(cat)}>
                    <Trash2 size={12} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Add new card */}
          <Card className="border-dashed cursor-pointer hover:border-primary hover:bg-primary/5 transition-all duration-200"
            onClick={() => { setEditTarget(null); setFormOpen(true) }}>
            <CardContent className="p-4 flex flex-col items-center justify-center h-full min-h-[140px] gap-2">
              <div className="w-10 h-10 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center">
                <Plus size={18} className="text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground font-medium">Tambah</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50" style={{ borderBottom: '1px solid var(--border)' }}>
                  {['', 'Nama Kategori', 'Jumlah Produk', 'Status', 'Warna', 'Aksi'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(cat => (
                  <tr key={cat.id} className="hover:bg-muted/30 transition-colors" style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="py-3 px-4 text-xl">{cat.icon ?? '📦'}</td>
                    <td className="py-3 px-4 font-medium">{cat.name}</td>
                    <td className="py-3 px-4 text-muted-foreground">{cat.product_count ?? 0} produk</td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className={cat.is_active ? 'border-emerald-400 text-emerald-600 text-xs' : 'text-xs'}>
                        {cat.is_active ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="w-6 h-6 rounded-full border" style={{ background: cat.color ?? '#3B82F6' }} />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => { setEditTarget(cat); setFormOpen(true) }}>
                          <Pencil size={12} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(cat)}>
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Kategori?</AlertDialogTitle>
            <AlertDialogDescription>
              Kategori <strong>&ldquo;{deleteTarget?.name}&rdquo;</strong> dengan {deleteTarget?.product_count ?? 0} produk akan dihapus.
              Produk di dalamnya tidak akan terhapus tetapi tidak akan memiliki kategori.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CategoryFormDialog open={formOpen} onOpenChange={setFormOpen} category={editTarget} />
    </div>
  )
}

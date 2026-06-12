'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { mockCategories } from '@/lib/mock-data'
import { toast } from 'sonner'

export default function KategoriPage() {
  const [categories] = useState(mockCategories)

  const colorMap: Record<string, string> = {
    '#3B82F6': 'oklch(0.55 0.22 264)',
    '#8B5CF6': 'oklch(0.55 0.22 310)',
    '#F59E0B': 'oklch(0.75 0.18 85)',
    '#10B981': 'oklch(0.65 0.18 160)',
    '#EF4444': 'oklch(0.65 0.2 30)',
    '#06B6D4': 'oklch(0.65 0.18 220)',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kategori Produk</h1>
          <p className="text-muted-foreground text-sm mt-1">Organisasikan produk Anda dalam kategori</p>
        </div>
        <Button size="sm" className="gap-1.5" style={{ background: 'oklch(0.55 0.22 264)' }}>
          <Plus size={15} /> Tambah Kategori
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {categories.map((cat) => {
          const color = colorMap[cat.color ?? '#3B82F6'] ?? 'oklch(0.55 0.22 264)'
          return (
            <Card key={cat.id} className="group overflow-hidden hover:shadow-md transition-all duration-200 cursor-pointer">
              <div className="h-2" style={{ background: color }} />
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                    style={{ background: `${color} / 0.1`, border: `1px solid ${color} / 0.2` }}>
                    <span style={{ filter: 'none' }}>
                      {cat.name === 'Pakaian' ? '👕' : cat.name === 'Elektronik' ? '💻' : cat.name === 'Makanan' ? '🍜' : cat.name === 'Minuman' ? '☕' : cat.name === 'Aksesoris' ? '⌚' : '✏️'}
                    </span>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil size={13} /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => toast.error('Hapus kategori memerlukan konfirmasi')}><Trash2 size={13} /></Button>
                  </div>
                </div>
                <h3 className="font-semibold text-base">{cat.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{cat.product_count} produk</p>
                <div className="mt-3">
                  <Badge variant="outline" className="text-xs" style={{ borderColor: color, color }}>
                    Aktif
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )
        })}

        {/* Add new card */}
        <Card className="border-dashed cursor-pointer hover:border-primary hover:bg-primary/5 transition-all duration-200"
          onClick={() => toast.info('Form tambah kategori akan muncul')}>
          <CardContent className="p-5 flex flex-col items-center justify-center h-full min-h-[140px] gap-2">
            <div className="w-10 h-10 rounded-full border-2 border-dashed border-muted-foreground/50 flex items-center justify-center">
              <Plus size={20} className="text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">Tambah Kategori</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

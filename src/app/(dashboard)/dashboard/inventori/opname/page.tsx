'use client'

import { useState, useMemo } from 'react'
import { Search, Save, ClipboardCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useProductStore } from '@/stores/use-product-store'
import { useStockMovementStore } from '@/stores/use-stock-movement-store'
import { toast } from 'sonner'

export default function StockOpnamePage() {
  const products = useProductStore((s) => s.products)
  const setStock = useProductStore((s) => s.setStock)
  const addMovement = useStockMovementStore((s) => s.addMovement)

  const [search, setSearch] = useState('')
  const [actual, setActual] = useState<Record<string, string>>({})

  const filtered = useMemo(
    () =>
      products.filter(
        (p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
      ),
    [products, search]
  )

  const changes = products.filter((p) => {
    const v = actual[p.id]
    return v !== undefined && v !== '' && Number(v) !== p.stock
  })
  const counted = Object.values(actual).filter((v) => v !== '').length

  const handleSave = () => {
    if (changes.length === 0) {
      toast.error('Belum ada selisih untuk disimpan')
      return
    }
    changes.forEach((p) => {
      const before = p.stock
      const after = Number(actual[p.id])
      setStock(p.id, after)
      addMovement({
        product_id: p.id,
        type: 'opname',
        quantity: after - before,
        before_stock: before,
        after_stock: after,
        notes: 'Stock opname',
      })
    })
    toast.success(`Opname tersimpan: ${changes.length} produk disesuaikan`)
    setActual({})
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardCheck size={22} /> Stock Opname</h1>
          <p className="text-muted-foreground text-sm mt-1">Hitung stok fisik dan sesuaikan dengan sistem</p>
        </div>
        <Button size="sm" className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={handleSave} disabled={changes.length === 0}>
          <Save size={15} /> Simpan Opname{changes.length > 0 ? ` (${changes.length})` : ''}
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Produk', value: products.length, color: 'text-foreground' },
          { label: 'Sudah Dihitung', value: counted, color: 'text-blue-600' },
          { label: 'Ada Selisih', value: changes.length, color: 'text-amber-600' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Cari produk / SKU..." className="pl-9 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50" style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Produk', 'SKU', 'Stok Sistem', 'Stok Fisik', 'Selisih'].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const v = actual[p.id]
                  const filled = v !== undefined && v !== ''
                  const diff = filled ? Number(v) - p.stock : null
                  return (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors" style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="py-3 px-4 font-medium">{p.name}</td>
                      <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{p.sku}</td>
                      <td className="py-3 px-4 font-semibold">{p.stock} <span className="text-xs text-muted-foreground font-normal">{p.unit}</span></td>
                      <td className="py-3 px-4">
                        <Input
                          type="number"
                          placeholder={String(p.stock)}
                          className="h-8 w-24"
                          value={v ?? ''}
                          onChange={(e) => setActual((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        />
                      </td>
                      <td className="py-3 px-4">
                        {diff === null || diff === 0 ? (
                          <span className="text-muted-foreground text-xs">{diff === 0 ? 'sesuai' : '-'}</span>
                        ) : (
                          <span className={`font-bold ${diff > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {diff > 0 ? '+' : ''}{diff}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="py-16 text-center">
                <p className="text-muted-foreground">Tidak ada produk ditemukan</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

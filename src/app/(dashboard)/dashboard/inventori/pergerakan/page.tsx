'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { mockStockMovements } from '@/lib/mock-data'
import { formatDateTime } from '@/lib/utils'
import type { MovementType } from '@/types'

const TYPE_CONFIG: Record<MovementType, { label: string; className: string }> = {
  in: { label: 'Masuk', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  out: { label: 'Keluar', className: 'bg-red-100 text-red-700 border-red-200' },
  adjustment: { label: 'Penyesuaian', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  transfer: { label: 'Transfer', className: 'bg-purple-100 text-purple-700 border-purple-200' },
  opname: { label: 'Opname', className: 'bg-amber-100 text-amber-700 border-amber-200' },
}

export default function PergerakanStokPage() {
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const filtered = mockStockMovements.filter((m) =>
    typeFilter === 'all' || m.type === typeFilter
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pergerakan Stok</h1>
        <p className="text-muted-foreground text-sm mt-1">Riwayat semua perubahan stok produk</p>
      </div>

      <div className="flex gap-3">
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? 'all')}>
          <SelectTrigger className="w-44 h-9 text-sm">
            <SelectValue placeholder="Semua Tipe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Tipe</SelectItem>
            <SelectItem value="in">Masuk</SelectItem>
            <SelectItem value="out">Keluar</SelectItem>
            <SelectItem value="adjustment">Penyesuaian</SelectItem>
            <SelectItem value="transfer">Transfer</SelectItem>
            <SelectItem value="opname">Opname</SelectItem>
          </SelectContent>
        </Select>
        <span className="self-center text-sm text-muted-foreground">{filtered.length} pergerakan</span>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50" style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Tanggal', 'Produk', 'Tipe', 'Qty', 'Stok Awal', 'Stok Akhir', 'Catatan', 'Operator'].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const cfg = TYPE_CONFIG[m.type]
                  return (
                    <tr key={m.id} className="hover:bg-muted/30 transition-colors" style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="py-3 px-4 text-xs text-muted-foreground">{formatDateTime(m.created_at)}</td>
                      <td className="py-3 px-4">
                        <p className="font-medium">{m.product?.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{m.product?.sku}</p>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`font-bold ${m.quantity > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {m.quantity > 0 ? '+' : ''}{m.quantity}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{m.before_stock}</td>
                      <td className="py-3 px-4 font-semibold">{m.after_stock}</td>
                      <td className="py-3 px-4 text-muted-foreground text-xs max-w-[200px] truncate">{m.notes ?? '-'}</td>
                      <td className="py-3 px-4 text-sm">{m.created_by_name ?? m.created_by}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="py-16 text-center">
                <p className="text-muted-foreground">Tidak ada data pergerakan stok</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

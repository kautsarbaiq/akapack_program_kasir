'use client'

import { useState } from 'react'
import { Search, Download, Eye, FileText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { useTransactionStore } from '@/stores/use-transaction-store'
import { formatRupiah, formatDateTime } from '@/lib/utils'
import type { Transaction } from '@/types'
import { PAYMENT_LABELS, PAYMENT_COLORS, PAYMENT_METHODS } from '@/lib/constants'
import { toast } from 'sonner'

export default function PenjualanPage() {
  const transactions = useTransactionStore((s) => s.transactions)
  const voidTransaction = useTransactionStore((s) => s.voidTransaction)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Transaction | null>(null)

  const totalOmzet = transactions.filter(t => t.status === 'completed').reduce((s, t) => s + t.total, 0)
  const totalTrx = transactions.filter(t => t.status === 'completed').length

  const filtered = transactions.filter((t) => {
    const q = search.toLowerCase()
    return !search || t.transaction_number.toLowerCase().includes(q) || (t.customer?.name ?? '').toLowerCase().includes(q)
  })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Riwayat Transaksi</h1>
          <p className="text-muted-foreground text-sm mt-1">Semua transaksi penjualan hari ini</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <Download size={14} /> Export Excel
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Transaksi', value: totalTrx },
          { label: 'Total Omzet', value: formatRupiah(totalOmzet), small: true },
          { label: 'Rata-rata / Transaksi', value: formatRupiah(totalTrx ? Math.round(totalOmzet / totalTrx) : 0), small: true },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className={`font-bold ${s.small ? 'text-xl' : 'text-2xl'}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Cari no. transaksi, pelanggan..." className="pl-9 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select defaultValue="all">
          <SelectTrigger className="w-36 h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Metode</SelectItem>
            {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select defaultValue="all">
          <SelectTrigger className="w-36 h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="completed">Selesai</SelectItem>
            <SelectItem value="void">Void</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50" style={{ borderBottom: '1px solid var(--border)' }}>
                  {['No. Transaksi', 'Pelanggan', 'Items', 'Total', 'Metode', 'Kasir', 'Waktu', 'Status', 'Aksi'].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/30 transition-colors" style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="py-3 px-4 font-mono text-xs font-semibold">{t.transaction_number}</td>
                    <td className="py-3 px-4 text-sm">{t.customer?.name ?? <span className="text-muted-foreground">Umum</span>}</td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">{t.items.length} item</td>
                    <td className="py-3 px-4 font-bold">{formatRupiah(t.total)}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAYMENT_COLORS[t.payment_method] ?? ''}`}>
                        {PAYMENT_LABELS[t.payment_method]}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{t.cashier?.full_name ?? '-'}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">{formatDateTime(t.created_at)}</td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className={`text-xs ${t.status === 'completed' ? 'border-emerald-400 text-emerald-600' : t.status === 'pending' ? 'border-amber-400 text-amber-600' : 'border-destructive text-destructive'}`}>
                        {t.status === 'completed' ? 'Selesai' : t.status === 'pending' ? 'Pending' : 'Void'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelected(t)}>
                        <Eye size={13} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader className="pb-4">
                <SheetTitle className="flex items-center gap-2">
                  <FileText size={18} /> Detail Transaksi
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-5">
                <div className="rounded-xl p-4 space-y-2 bg-muted/50">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">No. Transaksi</span><span className="font-mono font-semibold">{selected.transaction_number}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Waktu</span><span>{formatDateTime(selected.created_at)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Pelanggan</span><span>{selected.customer?.name ?? 'Umum'}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Status</span>
                    <Badge variant="outline" className={`text-xs ${selected.status === 'completed' ? 'border-emerald-400 text-emerald-600' : selected.status === 'pending' ? 'border-amber-400 text-amber-600' : 'border-destructive text-destructive'}`}>
                      {selected.status === 'completed' ? 'Selesai' : selected.status === 'pending' ? 'Pending' : 'Void'}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Produk Dibeli</p>
                  {selected.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
                      <span>{item.product_name} × {item.quantity}</span>
                      <span className="font-semibold">{formatRupiah(item.subtotal)}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{formatRupiah(selected.subtotal)}</span></div>
                  {selected.discount_amount > 0 && <div className="flex justify-between text-sm text-emerald-600"><span>Diskon</span><span>-{formatRupiah(selected.discount_amount)}</span></div>}
                  <Separator />
                  <div className="flex justify-between font-bold text-lg"><span>Total</span><span>{formatRupiah(selected.total)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Dibayar</span><span>{formatRupiah(selected.paid_amount)}</span></div>
                  {selected.change_amount > 0 && <div className="flex justify-between text-sm text-emerald-600 font-semibold"><span>Kembalian</span><span>{formatRupiah(selected.change_amount)}</span></div>}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1 gap-2" onClick={() => toast.info('Fitur cetak struk')}>
                    <FileText size={14} /> Cetak Struk
                  </Button>
                  {selected.status === 'completed' && (
                    <Button variant="destructive" className="flex-1" onClick={() => {
                      if (confirm('Void transaksi ini? Stok tidak dikembalikan otomatis.')) {
                        voidTransaction(selected.id); toast.success('Transaksi berhasil di-void'); setSelected(null)
                      }
                    }}>
                      Void Transaksi
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BarChart3, Download, TrendingUp, ShoppingCart, Package, Users } from 'lucide-react'
import { useTransactionStore } from '@/stores/use-transaction-store'
import { useCustomerStore } from '@/stores/use-customer-store'
import { formatRupiah, formatNumber } from '@/lib/utils'
import Link from 'next/link'

export default function LaporanPage() {
  const transactions = useTransactionStore((s) => s.transactions)
  const customers = useCustomerStore((s) => s.customers)

  // Semua statistik dihitung dari transaksi NYATA bulan berjalan (bukan mock)
  const r = useMemo(() => {
    const completed = transactions.filter((t) => t.status === 'completed')
    const now = new Date()
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const monthTrx = completed.filter((t) => (t.created_at || '').slice(0, 7) === ym)
    const revenue = monthTrx.reduce((s, t) => s + t.total, 0)
    const itemsSold = monthTrx.reduce((s, t) => s + t.items.reduce((a, i) => a + i.quantity, 0), 0)
    const newCust = customers.filter((c) => (c.created_at || '').slice(0, 7) === ym).length

    const agg: Record<string, { name: string; sold: number; rev: number }> = {}
    monthTrx.forEach((t) => t.items.forEach((it) => {
      const k = it.product_id || it.product_name
      if (!agg[k]) agg[k] = { name: it.product_name, sold: 0, rev: 0 }
      agg[k].sold += it.quantity
      agg[k].rev += it.subtotal
    }))
    const totalRev = Object.values(agg).reduce((s, p) => s + p.rev, 0)
    const top = Object.values(agg)
      .map((p) => ({ ...p, pct: totalRev > 0 ? Math.round((p.rev / totalRev) * 100) : 0 }))
      .sort((a, b) => b.rev - a.rev)
      .slice(0, 10)

    return { revenue, trxCount: monthTrx.length, itemsSold, newCust, top }
  }, [transactions, customers])

  const reportLinks = [
    { title: 'Laporan Penjualan', desc: 'Omzet, transaksi, dan tren harian', icon: TrendingUp, href: '/dashboard/penjualan/laporan', color: 'oklch(0.55 0.22 264)' },
    { title: 'Laporan Produk', desc: 'Produk terlaris dan pergerakan stok', icon: Package, href: '/dashboard/inventori/pergerakan', color: 'oklch(0.65 0.18 160)' },
    { title: 'Laporan Pelanggan', desc: 'Aktivitas dan loyalitas pelanggan', icon: Users, href: '/dashboard/pelanggan', color: 'oklch(0.65 0.2 310)' },
    { title: 'Laporan Transaksi', desc: 'Riwayat lengkap semua transaksi', icon: ShoppingCart, href: '/dashboard/penjualan', color: 'oklch(0.75 0.18 85)' },
  ]

  const summary = [
    { label: 'Total Omzet Bulan Ini', value: formatRupiah(r.revenue), icon: TrendingUp, color: 'oklch(0.55 0.22 264)' },
    { label: 'Total Transaksi', value: formatNumber(r.trxCount), icon: ShoppingCart, color: 'oklch(0.65 0.18 160)' },
    { label: 'Produk Terjual', value: formatNumber(r.itemsSold), icon: Package, color: 'oklch(0.75 0.18 85)' },
    { label: 'Pelanggan Baru', value: formatNumber(r.newCust), icon: Users, color: 'oklch(0.65 0.2 310)' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Laporan & Analitik</h1>
          <p className="text-muted-foreground text-sm mt-1">Ringkasan performa bisnis bulan ini (data nyata)</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Download size={14} /> Export Semua
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summary.map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.label}>
              <CardContent className="p-5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                  style={{ background: `${s.color} / 0.1` }}>
                  <Icon size={18} style={{ color: s.color }} />
                </div>
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Quick access to detailed reports */}
      <div className="grid sm:grid-cols-2 gap-4">
        {reportLinks.map((rl) => {
          const Icon = rl.icon
          return (
            <Link key={rl.href} href={rl.href}>
              <Card className="hover:shadow-md transition-all duration-200 cursor-pointer group">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: `${rl.color.replace(')', ' / 0.1)')}` }}>
                    <Icon size={22} style={{ color: rl.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold group-hover:text-primary transition-colors">{rl.title}</p>
                    <p className="text-sm text-muted-foreground truncate">{rl.desc}</p>
                  </div>
                  <BarChart3 size={16} className="text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Top products summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Produk Bulan Ini</CardTitle>
        </CardHeader>
        <CardContent>
          {r.top.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Belum ada penjualan bulan ini.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['#', 'Produk', 'Qty Terjual', 'Revenue', 'Kontribusi'].map((h) => (
                    <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.top.map((p, i) => (
                  <tr key={p.name + i} className="hover:bg-muted/30" style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="py-2.5 px-3 font-bold text-muted-foreground">#{i + 1}</td>
                    <td className="py-2.5 px-3 font-medium">{p.name}</td>
                    <td className="py-2.5 px-3">{formatNumber(p.sold)}</td>
                    <td className="py-2.5 px-3 font-semibold">{formatRupiah(p.rev)}</td>
                    <td className="py-2.5 px-3">
                      <Badge variant="secondary" className="text-xs">{p.pct}%</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BarChart3, Download, TrendingUp, ShoppingCart, Package, Users } from 'lucide-react'
import { mockDashboardStats, mockTopProducts, mockTransactions } from '@/lib/mock-data'
import { formatRupiah, formatNumber } from '@/lib/utils'
import Link from 'next/link'

export default function LaporanPage() {
  const stats = mockDashboardStats
  const completedTrx = mockTransactions.filter(t => t.status === 'completed')
  const totalRevenue = completedTrx.reduce((s, t) => s + t.total, 0)

  const reportLinks = [
    { title: 'Laporan Penjualan', desc: 'Omzet, transaksi, dan tren harian', icon: TrendingUp, href: '/dashboard/penjualan/laporan', color: 'oklch(0.55 0.22 264)' },
    { title: 'Laporan Produk', desc: 'Produk terlaris dan pergerakan stok', icon: Package, href: '/dashboard/inventori/pergerakan', color: 'oklch(0.65 0.18 160)' },
    { title: 'Laporan Pelanggan', desc: 'Aktivitas dan loyalitas pelanggan', icon: Users, href: '/dashboard/pelanggan', color: 'oklch(0.65 0.2 310)' },
    { title: 'Laporan Transaksi', desc: 'Riwayat lengkap semua transaksi', icon: ShoppingCart, href: '/dashboard/penjualan', color: 'oklch(0.75 0.18 85)' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Laporan & Analitik</h1>
          <p className="text-muted-foreground text-sm mt-1">Ringkasan performa bisnis Anda</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Download size={14} /> Export Semua
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Omzet Bulan Ini', value: formatRupiah(totalRevenue * 25), icon: TrendingUp, color: 'oklch(0.55 0.22 264)' },
          { label: 'Total Transaksi', value: formatNumber(stats.today_transactions * 25), icon: ShoppingCart, color: 'oklch(0.65 0.18 160)' },
          { label: 'Produk Terjual', value: formatNumber(stats.today_items_sold * 25), icon: Package, color: 'oklch(0.75 0.18 85)' },
          { label: 'Pelanggan Baru', value: formatNumber(stats.today_new_customers * 25), icon: Users, color: 'oklch(0.65 0.2 310)' },
        ].map((s) => {
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
        {reportLinks.map((r) => {
          const Icon = r.icon
          return (
            <Link key={r.href} href={r.href}>
              <Card className="hover:shadow-md transition-all duration-200 cursor-pointer group">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: `${r.color.replace(')', ' / 0.1)')}` }}>
                    <Icon size={22} style={{ color: r.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold group-hover:text-primary transition-colors">{r.title}</p>
                    <p className="text-sm text-muted-foreground truncate">{r.desc}</p>
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
          <CardTitle className="text-base">🏆 Top Produk Bulan Ini</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['#', 'Produk', 'Qty Terjual', 'Revenue', 'Kontribusi'].map((h) => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mockTopProducts.map((p, i) => (
                <tr key={p.product_id} className="hover:bg-muted/30" style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="py-2.5 px-3 font-bold text-muted-foreground">#{i + 1}</td>
                  <td className="py-2.5 px-3 font-medium">{p.product_name}</td>
                  <td className="py-2.5 px-3">{formatNumber(p.total_sold)}</td>
                  <td className="py-2.5 px-3 font-semibold">{formatRupiah(p.total_revenue)}</td>
                  <td className="py-2.5 px-3">
                    <Badge variant="secondary" className="text-xs">{p.percentage}%</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

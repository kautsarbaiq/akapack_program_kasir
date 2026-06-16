'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { TrendingUp, TrendingDown, Download } from 'lucide-react'
import { mockSalesChart, mockTopProducts, mockTransactions } from '@/lib/mock-data'
import { formatRupiah, formatNumber } from '@/lib/utils'

const PERIODS = [
  { value: '7', label: 'Hari Ini (7H)' },
  { value: '30', label: 'Bulan Ini (30H)' },
  { value: '90', label: '3 Bulan' },
]

const PIE_COLORS = [
  'oklch(0.55 0.22 264)',
  'oklch(0.65 0.18 160)',
  'oklch(0.75 0.18 85)',
  'oklch(0.65 0.2 310)',
  'oklch(0.65 0.18 30)',
  'oklch(0.65 0.18 220)',
]

function KPICard({ title, value, change, subtitle }: { title: string; value: string; change?: number; subtitle?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        {change !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-semibold mb-2 ${change >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {change >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {Math.abs(change)}% vs periode sebelumnya
          </div>
        )}
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground mt-1">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  )
}

export default function LaporanPenjualanPage() {
  const [period, setPeriod] = useState('30')

  const chartData = mockSalesChart.slice(-Number(period))
  const totalRevenue = chartData.reduce((s, d) => s + d.revenue, 0)
  const totalTrx = chartData.reduce((s, d) => s + d.transactions, 0)
  const avgTrx = totalTrx ? Math.round(totalRevenue / totalTrx) : 0

  // Payment method breakdown from mock transactions
  const paymentStats = mockTransactions
    .filter(t => t.status === 'completed')
    .reduce<Record<string, { count: number; total: number }>>((acc, t) => {
      if (!acc[t.payment_method]) acc[t.payment_method] = { count: 0, total: 0 }
      acc[t.payment_method].count++
      acc[t.payment_method].total += t.total
      return acc
    }, {})

  const paymentData = Object.entries(paymentStats).map(([method, data]) => ({
    name: method === 'cash' ? 'Tunai' : method === 'qris' ? 'QRIS' : method === 'debit' ? 'Debit' : method,
    value: data.total,
    count: data.count,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Laporan Penjualan</h1>
          <p className="text-muted-foreground text-sm mt-1">Analisis mendalam performa penjualan toko</p>
        </div>
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <Button key={p.value} variant={period === p.value ? 'default' : 'outline'} size="sm" className="text-xs"
              onClick={() => setPeriod(p.value)}
              style={period === p.value ? { background: 'oklch(0.55 0.22 264)' } : {}}>
              {p.label}
            </Button>
          ))}
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Download size={13} /> Export
          </Button>
        </div>
      </div>

      <Tabs defaultValue="ringkasan">
        <TabsList>
          <TabsTrigger value="ringkasan">Ringkasan</TabsTrigger>
          <TabsTrigger value="produk">Per Produk</TabsTrigger>
          <TabsTrigger value="metode">Per Metode Bayar</TabsTrigger>
        </TabsList>

        {/* Ringkasan */}
        <TabsContent value="ringkasan" className="space-y-6 mt-6">
          <div className="grid grid-cols-3 gap-4">
            <KPICard title="Total Penjualan" value={formatRupiah(totalRevenue)} change={12.5} />
            <KPICard title="Total Transaksi" value={formatNumber(totalTrx)} change={8.3} />
            <KPICard title="Rata-rata / Transaksi" value={formatRupiah(avgTrx)} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tren Penjualan</CardTitle>
              <CardDescription>Omzet harian dalam periode dipilih</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.55 0.22 264)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="oklch(0.55 0.22 264)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 250)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} interval={Math.floor(chartData.length / 7)} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}jt`} />
                  <Tooltip formatter={(v: unknown) => [formatRupiah(Number(v)), 'Omzet']} contentStyle={{ borderRadius: '12px', fontSize: 12 }} />
                  <Area type="monotone" dataKey="revenue" stroke="oklch(0.55 0.22 264)" strokeWidth={2.5} fill="url(#grad1)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Per Produk */}
        <TabsContent value="produk" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Produk Terlaris</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50" style={{ borderBottom: '1px solid var(--border)' }}>
                    {['#', 'Produk', 'SKU', 'Qty Terjual', 'Total Penjualan', 'Kontribusi'].map((h) => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mockTopProducts.map((p, i) => (
                    <tr key={p.product_id} className="hover:bg-muted/30 transition-colors" style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="py-3 px-4 font-bold text-muted-foreground">#{i + 1}</td>
                      <td className="py-3 px-4 font-medium">{p.product_name}</td>
                      <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{p.product_sku}</td>
                      <td className="py-3 px-4">{formatNumber(p.total_sold)}</td>
                      <td className="py-3 px-4 font-semibold">{formatRupiah(p.total_revenue)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${p.percentage}%`, background: 'oklch(0.55 0.22 264)' }} />
                          </div>
                          <span className="text-xs text-muted-foreground w-10 text-right">{p.percentage}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Per Metode Bayar */}
        <TabsContent value="metode" className="mt-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Distribusi Metode Pembayaran</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={paymentData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                      {paymentData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend />
                    <Tooltip formatter={(v: unknown) => [formatRupiah(Number(v)), 'Total']} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Detail Per Metode</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Metode', 'Transaksi', 'Total'].map((h) => (
                        <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paymentData.map((row, i) => (
                      <tr key={row.name} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                            {row.name}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-muted-foreground">{row.count}x</td>
                        <td className="py-3 px-3 font-semibold">{formatRupiah(row.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

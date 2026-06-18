'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { TrendingUp, TrendingDown, Download } from 'lucide-react'
import { useTransactionStore } from '@/stores/use-transaction-store'
import { useProductStore } from '@/stores/use-product-store'
import { formatRupiah, formatNumber } from '@/lib/utils'
import { PAYMENT_LABELS } from '@/lib/constants'

const PERIODS = [
  { value: '7', label: '7 Hari' },
  { value: '30', label: '30 Hari' },
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

function KPICard({ title, value, subtitle, accent }: { title: string; value: string; subtitle?: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className={`text-2xl font-bold ${accent ? 'text-emerald-600' : ''}`}>{value}</p>
        <p className="text-sm text-muted-foreground mt-1">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </CardContent>
    </Card>
  )
}

export default function LaporanPenjualanPage() {
  const transactions = useTransactionStore((s) => s.transactions)
  const products = useProductStore((s) => s.products)
  const [period, setPeriod] = useState('30')

  const report = useMemo(() => {
    const days = Number(period)
    const cutoff = Date.now() - days * 86400000
    const completed = transactions.filter(
      (t) => t.status === 'completed' && new Date(t.created_at).getTime() >= cutoff
    )

    const totalRevenue = completed.reduce((s, t) => s + t.total, 0)
    const totalTrx = completed.length
    const avgTrx = totalTrx ? Math.round(totalRevenue / totalTrx) : 0

    // HPP (perkiraan dari harga modal produk saat ini)
    const costById = new Map(products.map((p) => [p.id, p.cost_price]))
    let netSales = 0
    let cogs = 0
    completed.forEach((t) => {
      netSales += t.subtotal - t.discount_amount
      t.items.forEach((it) => {
        cogs += it.quantity * (costById.get(it.product_id) ?? 0)
      })
    })
    const grossProfit = netSales - cogs
    const margin = netSales > 0 ? Math.round((grossProfit / netSales) * 100) : 0

    // Tren harian
    const trend = Array.from({ length: days }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (days - 1 - i))
      const key = d.toISOString().slice(0, 10)
      const rev = completed.filter((t) => t.created_at.slice(0, 10) === key).reduce((s, t) => s + t.total, 0)
      return { label: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }), revenue: rev }
    })

    // Per produk
    const prodAgg: Record<string, { name: string; sku: string; qty: number; revenue: number }> = {}
    completed.forEach((t) =>
      t.items.forEach((it) => {
        const prod = products.find((p) => p.id === it.product_id)
        if (!prodAgg[it.product_id]) prodAgg[it.product_id] = { name: it.product_name, sku: prod?.sku ?? '-', qty: 0, revenue: 0 }
        prodAgg[it.product_id].qty += it.quantity
        prodAgg[it.product_id].revenue += it.subtotal
      })
    )
    const totalProdRevenue = Object.values(prodAgg).reduce((s, p) => s + p.revenue, 0)
    const topProducts = Object.values(prodAgg)
      .map((p) => ({ ...p, percentage: totalProdRevenue > 0 ? Math.round((p.revenue / totalProdRevenue) * 100) : 0 }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)

    // Per metode bayar
    const methodAgg: Record<string, { count: number; total: number }> = {}
    completed.forEach((t) => {
      const k = t.payment_method
      if (!methodAgg[k]) methodAgg[k] = { count: 0, total: 0 }
      methodAgg[k].count++
      methodAgg[k].total += t.total
    })
    const paymentData = Object.entries(methodAgg).map(([method, d]) => ({
      name: PAYMENT_LABELS[method] ?? method,
      value: d.total,
      count: d.count,
    }))

    // Per kasir
    const cashierAgg: Record<string, { count: number; total: number }> = {}
    completed.forEach((t) => {
      const name = t.cashier?.full_name ?? 'Tidak diketahui'
      if (!cashierAgg[name]) cashierAgg[name] = { count: 0, total: 0 }
      cashierAgg[name].count++
      cashierAgg[name].total += t.total
    })
    const cashierData = Object.entries(cashierAgg)
      .map(([name, d]) => ({ name, count: d.count, total: d.total, avg: d.count ? Math.round(d.total / d.count) : 0 }))
      .sort((a, b) => b.total - a.total)

    return { totalRevenue, totalTrx, avgTrx, netSales, cogs, grossProfit, margin, trend, topProducts, paymentData, cashierData }
  }, [transactions, products, period])

  const isEmpty = report.totalTrx === 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Laporan Penjualan</h1>
          <p className="text-muted-foreground text-sm mt-1">Analisis performa dari transaksi nyata</p>
        </div>
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <Button key={p.value} variant={period === p.value ? 'default' : 'outline'} size="sm"
              className={`text-xs ${period === p.value ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}`}
              onClick={() => setPeriod(p.value)}>
              {p.label}
            </Button>
          ))}
          <Button variant="outline" size="sm" className="gap-1.5 text-xs"><Download size={13} /> Export</Button>
        </div>
      </div>

      {isEmpty && (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
          Belum ada transaksi pada periode ini. Lakukan penjualan di POS — laporan akan terisi otomatis.
        </CardContent></Card>
      )}

      <Tabs defaultValue="ringkasan">
        <TabsList>
          <TabsTrigger value="ringkasan">Ringkasan</TabsTrigger>
          <TabsTrigger value="laba">Laba / Rugi</TabsTrigger>
          <TabsTrigger value="produk">Per Produk</TabsTrigger>
          <TabsTrigger value="metode">Per Metode</TabsTrigger>
          <TabsTrigger value="kasir">Per Kasir</TabsTrigger>
        </TabsList>

        {/* Ringkasan */}
        <TabsContent value="ringkasan" className="space-y-6 mt-6">
          <div className="grid grid-cols-3 gap-4">
            <KPICard title="Total Omzet" value={formatRupiah(report.totalRevenue)} />
            <KPICard title="Total Transaksi" value={formatNumber(report.totalTrx)} />
            <KPICard title="Rata-rata / Transaksi" value={formatRupiah(report.avgTrx)} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tren Penjualan</CardTitle>
              <CardDescription>Omzet harian dalam periode dipilih</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={report.trend} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.55 0.22 264)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="oklch(0.55 0.22 264)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 250)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(report.trend.length / 7))} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}jt`} />
                  <Tooltip formatter={(v: unknown) => [formatRupiah(Number(v)), 'Omzet']} contentStyle={{ borderRadius: '12px', fontSize: 12 }} />
                  <Area type="monotone" dataKey="revenue" stroke="oklch(0.55 0.22 264)" strokeWidth={2.5} fill="url(#grad1)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Laba / Rugi */}
        <TabsContent value="laba" className="space-y-6 mt-6">
          <div className="grid grid-cols-3 gap-4">
            <KPICard title="Penjualan Bersih" value={formatRupiah(report.netSales)} subtitle="setelah diskon, sebelum pajak" />
            <KPICard title="HPP (Modal)" value={formatRupiah(report.cogs)} subtitle="perkiraan dari harga modal" />
            <KPICard title="Laba Kotor" value={formatRupiah(report.grossProfit)} subtitle={`Margin ${report.margin}%`} accent />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ringkasan Laba Kotor</CardTitle>
              <CardDescription>Laba kotor = Penjualan bersih − HPP (Harga Pokok Penjualan)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm max-w-md">
              <div className="flex justify-between"><span className="text-muted-foreground">Penjualan Bersih</span><span className="font-medium">{formatRupiah(report.netSales)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">HPP</span><span className="font-medium text-red-500">−{formatRupiah(report.cogs)}</span></div>
              <div className="flex justify-between font-bold border-t pt-2"><span>Laba Kotor</span><span className="text-emerald-600">{formatRupiah(report.grossProfit)}</span></div>
              <p className="text-xs text-muted-foreground pt-1">*HPP dihitung dari harga modal produk saat ini (perkiraan). Pajak & service charge tidak dihitung sebagai laba.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Per Produk */}
        <TabsContent value="produk" className="mt-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Produk Terlaris</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50" style={{ borderBottom: '1px solid var(--border)' }}>
                    {['#', 'Produk', 'SKU', 'Qty', 'Penjualan', 'Kontribusi'].map((h) => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.topProducts.map((p, i) => (
                    <tr key={p.sku + i} className="hover:bg-muted/30 transition-colors" style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="py-3 px-4 font-bold text-muted-foreground">#{i + 1}</td>
                      <td className="py-3 px-4 font-medium">{p.name}</td>
                      <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{p.sku}</td>
                      <td className="py-3 px-4">{formatNumber(p.qty)}</td>
                      <td className="py-3 px-4 font-semibold">{formatRupiah(p.revenue)}</td>
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
                  {report.topProducts.length === 0 && (
                    <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">Belum ada data</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Per Metode */}
        <TabsContent value="metode" className="mt-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Distribusi Metode Pembayaran</CardTitle></CardHeader>
              <CardContent>
                {report.paymentData.length === 0 ? (
                  <p className="py-16 text-center text-sm text-muted-foreground">Belum ada data</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={report.paymentData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}
                        label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                        {report.paymentData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Legend />
                      <Tooltip formatter={(v: unknown) => [formatRupiah(Number(v)), 'Total']} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
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
                    {report.paymentData.map((row, i) => (
                      <tr key={row.name} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td className="py-3 px-3"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />{row.name}</div></td>
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

        {/* Per Kasir */}
        <TabsContent value="kasir" className="mt-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Performa Per Kasir</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50" style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Kasir', 'Transaksi', 'Total Omzet', 'Rata-rata'].map((h) => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.cashierData.map((c) => (
                    <tr key={c.name} className="hover:bg-muted/30 transition-colors" style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="py-3 px-4 font-medium">{c.name}</td>
                      <td className="py-3 px-4 text-muted-foreground">{c.count}x</td>
                      <td className="py-3 px-4 font-semibold">{formatRupiah(c.total)}</td>
                      <td className="py-3 px-4">{formatRupiah(c.avg)}</td>
                    </tr>
                  ))}
                  {report.cashierData.length === 0 && (
                    <tr><td colSpan={4} className="py-10 text-center text-muted-foreground">Belum ada data</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

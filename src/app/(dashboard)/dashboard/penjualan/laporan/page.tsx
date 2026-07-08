'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, BarChart, Bar
} from 'recharts'
import { TrendingUp, TrendingDown, Download } from 'lucide-react'
import { useTransactionStore } from '@/stores/use-transaction-store'
import { useProductStore } from '@/stores/use-product-store'
import { formatRupiah, formatNumber, localDay } from '@/lib/utils'
import { PAYMENT_LABELS } from '@/lib/constants'
import { OutletFilter } from '@/components/dashboard/outlet-filter'
import { useRole, useCurrentUserStore } from '@/stores/use-current-user-store'
import { useOutletStore } from '@/stores/use-outlet-store'
import { Badge } from '@/components/ui/badge'

const PERIODS = [
  { value: '1', label: 'Hari Ini' },
  { value: '7', label: '7 Hari' },
  { value: '30', label: 'Bulanan' },
  { value: '90', label: '3 Bulan' },
  { value: '365', label: 'Tahunan' },
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
  const outlets = useOutletStore((s) => s.outlets)
  const [period, setPeriod] = useState('30')
  const [outletFilter, setOutletFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const { canSeeProfit, isCashier } = useRole() // tab Laba/Rugi hanya owner
  const me = useCurrentUserStore((s) => s.user)
  // Kasir DIKUNCI ke cabangnya (tak bisa pilih cabang lain); owner/manager bebas.
  const lockedOutlet = isCashier && me?.outletId ? me.outletId : null
  const effectiveOutlet = lockedOutlet ?? outletFilter

  // Mode rentang tanggal kustom (per tanggal). Kalau aktif, override tombol periode.
  const useRange = !!(dateFrom || dateTo)
  const rangeStart = dateFrom || dateTo
  const rangeEnd = dateTo || dateFrom

  const report = useMemo(() => {
    const days = Number(period)
    // Batas bawah = awal hari (lokal) dari (days-1) hari lalu → konsisten dgn bucket grafik tren
    // (mis. "7 Hari" = hari ini + 6 hari sebelumnya), bukan rolling days*24jam yang lebih lebar.
    const startDay = new Date(); startDay.setHours(0, 0, 0, 0); startDay.setDate(startDay.getDate() - (days - 1))
    const cutoff = startDay.getTime()
    const completed = transactions.filter((t) => {
      if (t.status !== 'completed') return false
      if (effectiveOutlet !== 'all' && t.outlet_id !== effectiveOutlet) return false
      if (useRange) {
        const d = localDay(t.created_at)
        return d >= rangeStart && d <= rangeEnd
      }
      return new Date(t.created_at).getTime() >= cutoff
    })

    const totalRevenue = completed.reduce((s, t) => s + t.total, 0)
    const totalTrx = completed.length
    const avgTrx = totalTrx ? Math.round(totalRevenue / totalTrx) : 0

    // HPP: pakai modal SNAPSHOT saat transaksi (it.cost_price) → laba historis tak berubah saat
    // harga modal diubah. Transaksi lama (sebelum migrasi, cost_price 0) fallback ke modal kini.
    const costById = new Map(products.map((p) => [p.id, p.cost_price]))
    let netSales = 0
    let cogs = 0
    completed.forEach((t) => {
      netSales += t.subtotal - t.discount_amount
      t.items.forEach((it) => {
        const unitCost = it.cost_price && it.cost_price > 0 ? it.cost_price : (costById.get(it.product_id) ?? 0)
        cogs += it.quantity * unitCost
      })
    })
    const grossProfit = netSales - cogs
    const margin = netSales > 0 ? Math.round((grossProfit / netSales) * 100) : 0

    // Tren harian — periode (N hari terakhir) ATAU rentang tanggal kustom.
    let trend: { label: string; revenue: number }[]
    if (useRange) {
      const start = new Date(rangeStart + 'T00:00:00')
      const end = new Date(rangeEnd + 'T00:00:00')
      const dayCount = Math.min(366, Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1))
      trend = Array.from({ length: dayCount }, (_, i) => {
        const d = new Date(start); d.setDate(d.getDate() + i)
        const key = localDay(d)
        const rev = completed.filter((t) => localDay(t.created_at) === key).reduce((s, t) => s + t.total, 0)
        return { label: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }), revenue: rev }
      })
    } else {
      trend = Array.from({ length: days }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (days - 1 - i))
        const key = localDay(d)
        const rev = completed.filter((t) => localDay(t.created_at) === key).reduce((s, t) => s + t.total, 0)
        return { label: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }), revenue: rev }
      })
    }

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

    // Distribusi per jam (00–23): berapa orderan & omzet tiap jam — untuk lihat jam ramai.
    const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: `${String(h).padStart(2, '0')}.00`, orders: 0, revenue: 0 }))
    completed.forEach((t) => {
      const h = new Date(t.created_at).getHours()
      hourly[h].orders += 1
      hourly[h].revenue += t.total
    })
    const peakHour = hourly.reduce((a, b) => (b.orders > a.orders ? b : a), hourly[0])

    return { totalRevenue, totalTrx, avgTrx, netSales, cogs, grossProfit, margin, trend, topProducts, paymentData, cashierData, hourly, peakHour }
  }, [transactions, products, period, effectiveOutlet, useRange, rangeStart, rangeEnd])

  const isEmpty = report.totalTrx === 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Laporan Penjualan</h1>
          <p className="text-muted-foreground text-sm mt-1">Analisis performa dari transaksi nyata</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap justify-end">
          {lockedOutlet
            ? <Badge variant="outline" className="h-9 px-3 text-xs">{outlets.find((o) => o.id === lockedOutlet)?.name ?? 'Cabang saya'}</Badge>
            : <OutletFilter value={outletFilter} onChange={setOutletFilter} />}
          {PERIODS.map((p) => (
            <Button key={p.value} variant={!useRange && period === p.value ? 'default' : 'outline'} size="sm"
              className={`text-xs ${!useRange && period === p.value ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''} ${useRange ? 'opacity-50' : ''}`}
              onClick={() => { setPeriod(p.value); setDateFrom(''); setDateTo('') }}>
              {p.label}
            </Button>
          ))}
          <Input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-36 text-sm" title="Dari tanggal" />
          <span className="text-muted-foreground text-xs">s/d</span>
          <Input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-36 text-sm" title="Sampai tanggal" />
          {useRange && <Button variant="ghost" size="sm" className="h-9 px-2 text-xs" onClick={() => { setDateFrom(''); setDateTo('') }}>Reset</Button>}
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
          {canSeeProfit && <TabsTrigger value="laba">Laba / Rugi</TabsTrigger>}
          <TabsTrigger value="jam">Per Jam</TabsTrigger>
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

        {/* Per Jam — distribusi orderan tiap jam (laporan harian) */}
        <TabsContent value="jam" className="space-y-6 mt-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <KPICard title="Total Orderan" value={`${report.totalTrx}`} />
            <KPICard title="Jam Tersibuk" value={report.peakHour.orders > 0 ? report.peakHour.hour : '—'} subtitle={report.peakHour.orders > 0 ? `${report.peakHour.orders} orderan` : 'belum ada'} accent />
            <KPICard title="Omzet Jam Tersibuk" value={formatRupiah(report.peakHour.revenue)} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Orderan per Jam</CardTitle>
              <CardDescription>Jumlah transaksi di tiap jam pada periode terpilih</CardDescription>
            </CardHeader>
            <CardContent>
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.hourly} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 250)" vertical={false} />
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={1} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip formatter={(v: unknown, n: unknown) => n === 'orders' ? [`${v} orderan`, 'Orderan'] : [formatRupiah(Number(v)), 'Omzet']} contentStyle={{ borderRadius: '12px', fontSize: 12 }} />
                    <Bar dataKey="orders" fill="oklch(0.55 0.22 264)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead><tr className="bg-muted/50" style={{ borderBottom: '1px solid var(--border)' }}>{['Jam', 'Orderan', 'Omzet'].map((h) => <th key={h} className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground">{h}</th>)}</tr></thead>
                <tbody>
                  {report.hourly.filter((h) => h.orders > 0).map((h) => (
                    <tr key={h.hour} style={{ borderBottom: '1px solid var(--border)' }} className="hover:bg-muted/30">
                      <td className="py-2.5 px-4 font-medium">{h.hour}</td>
                      <td className="py-2.5 px-4">{h.orders} orderan</td>
                      <td className="py-2.5 px-4">{formatRupiah(h.revenue)}</td>
                    </tr>
                  ))}
                  {report.hourly.every((h) => h.orders === 0) && <tr><td colSpan={3} className="py-10 text-center text-muted-foreground">Belum ada orderan pada periode ini</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Laba / Rugi — hanya owner */}
        {canSeeProfit && <TabsContent value="laba" className="space-y-6 mt-6">
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
              <p className="text-xs text-muted-foreground pt-1">*HPP dari harga modal SAAT TRANSAKSI (snapshot); transaksi lama tanpa snapshot memakai modal saat ini. Pajak & service charge tidak dihitung sebagai laba.</p>
            </CardContent>
          </Card>
        </TabsContent>}

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

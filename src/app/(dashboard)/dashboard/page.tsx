'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar,
} from 'recharts'
import {
  TrendingUp, TrendingDown, ShoppingCart, Package,
  Users, DollarSign, AlertTriangle, Eye, Plus, Trophy,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { useTransactionStore } from '@/stores/use-transaction-store'
import { OutletFilter } from '@/components/dashboard/outlet-filter'
import { useProductStore } from '@/stores/use-product-store'
import { useCustomerStore } from '@/stores/use-customer-store'
import { useSettingsStore } from '@/stores/use-settings-store'
import { formatRupiah, formatNumber, formatDateTime, localDay } from '@/lib/utils'
import { PAYMENT_LABELS } from '@/lib/constants'
import { useRole } from '@/stores/use-current-user-store'

export default function DashboardPage() {
  const transactions = useTransactionStore((s) => s.transactions)
  const products = useProductStore((s) => s.products)
  const customers = useCustomerStore((s) => s.customers)
  const storeName = useSettingsStore((s) => s.storeName)
  const { canSeeRevenue } = useRole() // manager TIDAK lihat omzet/rincian penjualan
  const [period, setPeriod] = useState('30')
  const [outletFilter, setOutletFilter] = useState('all')

  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Selamat Pagi' : now.getHours() < 17 ? 'Selamat Siang' : 'Selamat Sore'

  const r = useMemo(() => {
    const txns = outletFilter === 'all' ? transactions : transactions.filter((t) => t.outlet_id === outletFilter)
    const completed = txns.filter((t) => t.status === 'completed')
    const todayKey = localDay(new Date())
    const yd = new Date(); yd.setDate(yd.getDate() - 1)
    const yKey = localDay(yd)
    const sumDay = (key: string) => {
      const ts = completed.filter((t) => localDay(t.created_at) === key)
      return {
        rev: ts.reduce((s, t) => s + t.total, 0),
        trx: ts.length,
        items: ts.reduce((s, t) => s + t.items.reduce((a, i) => a + i.quantity, 0), 0),
      }
    }
    const today = sumDay(todayKey)
    const yest = sumDay(yKey)
    const pct = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : 0)
    const newCust = customers.filter((c) => (c.created_at ? localDay(c.created_at) : '') === todayKey).length

    const days = Number(period)
    const chart = Array.from({ length: days }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (days - 1 - i))
      const k = localDay(d)
      return {
        label: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
        revenue: completed.filter((t) => localDay(t.created_at) === k).reduce((s, t) => s + t.total, 0),
      }
    })

    const agg: Record<string, { name: string; sold: number; rev: number }> = {}
    completed.forEach((t) => t.items.forEach((it) => {
      if (!agg[it.product_id]) agg[it.product_id] = { name: it.product_name, sold: 0, rev: 0 }
      agg[it.product_id].sold += it.quantity
      agg[it.product_id].rev += it.subtotal
    }))
    const totalRev = Object.values(agg).reduce((s, p) => s + p.rev, 0)
    const top = Object.values(agg)
      .map((p) => ({ ...p, pct: totalRev > 0 ? Math.round((p.rev / totalRev) * 100) : 0 }))
      .sort((a, b) => b.rev - a.rev)
      .slice(0, 5)

    const low = products
      .filter((p) => p.is_active && p.stock <= p.min_stock)
      .map((p) => ({ id: p.id, name: p.name, sku: p.sku, cat: p.category?.name ?? '-', stock: p.stock, min: p.min_stock, status: p.stock === 0 ? 'out' : 'low' }))
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 6)

    const recent = txns.slice(0, 5)

    // Orderan per jam HARI INI (laporan harian per jam)
    const hourlyToday = Array.from({ length: 24 }, (_, h) => ({ hour: `${String(h).padStart(2, '0')}`, orders: 0, revenue: 0 }))
    completed.filter((t) => localDay(t.created_at) === todayKey).forEach((t) => {
      const h = new Date(t.created_at).getHours()
      hourlyToday[h].orders += 1
      hourlyToday[h].revenue += t.total
    })
    const peakToday = hourlyToday.reduce((a, b) => (b.orders > a.orders ? b : a), hourlyToday[0])

    return { today, revChange: pct(today.rev, yest.rev), trxChange: pct(today.trx, yest.trx), itemsChange: pct(today.items, yest.items), newCust, chart, top, low, recent, hourlyToday, peakToday }
  }, [transactions, products, customers, period, outletFilter])

  const kpiCards = [
    // Omzet hanya untuk owner — manager tak lihat angka rupiah penjualan.
    ...(canSeeRevenue ? [{ title: 'Omzet Hari Ini', value: formatRupiah(r.today.rev), change: r.revChange, icon: DollarSign, iconBg: 'oklch(0.55 0.22 264 / 0.1)', iconColor: 'oklch(0.55 0.22 264)' }] : []),
    { title: 'Jumlah Transaksi', value: formatNumber(r.today.trx), change: r.trxChange, icon: ShoppingCart, iconBg: 'oklch(0.65 0.18 160 / 0.1)', iconColor: 'oklch(0.55 0.18 160)' },
    { title: 'Produk Terjual', value: formatNumber(r.today.items), change: r.itemsChange, icon: Package, iconBg: 'oklch(0.75 0.18 85 / 0.1)', iconColor: 'oklch(0.6 0.18 85)' },
    { title: 'Pelanggan Baru', value: formatNumber(r.newCust), change: 0, icon: Users, iconBg: 'oklch(0.65 0.2 310 / 0.1)', iconColor: 'oklch(0.55 0.2 310)' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{greeting}!</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} — {storeName || 'AKAPACK'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <OutletFilter value={outletFilter} onChange={setOutletFilter} />
          <Link href="/pos">
            <Button size="sm" className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <ShoppingCart size={15} /> Buka POS Kasir
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon
          const isPositive = card.change >= 0
          const TrendIcon = isPositive ? TrendingUp : TrendingDown
          return (
            <Card key={card.title} className="overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: card.iconBg }}>
                    <Icon size={20} style={{ color: card.iconColor }} />
                  </div>
                  {card.change !== 0 && (
                    <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                      <TrendIcon size={12} />
                      {Math.abs(card.change)}%
                    </div>
                  )}
                </div>
                <p className="text-2xl font-bold text-foreground">{card.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{card.title}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {canSeeRevenue && (
      <Card>
        <CardHeader className="flex-row items-start justify-between pb-4">
          <div>
            <CardTitle>Grafik Penjualan</CardTitle>
            <CardDescription>Omzet harian (transaksi nyata)</CardDescription>
          </div>
          <Tabs value={period} onValueChange={setPeriod}>
            <TabsList className="h-8">
              <TabsTrigger value="7" className="text-xs h-7 px-2.5">7 Hari</TabsTrigger>
              <TabsTrigger value="30" className="text-xs h-7 px-2.5">30 Hari</TabsTrigger>
              <TabsTrigger value="90" className="text-xs h-7 px-2.5">3 Bulan</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={r.chart} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.55 0.22 264)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.55 0.22 264)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 250)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'oklch(0.6 0.01 250)' }} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(r.chart.length / 7))} />
              <YAxis tick={{ fontSize: 11, fill: 'oklch(0.6 0.01 250)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}jt`} />
              <Tooltip formatter={(val: unknown) => [formatRupiah(Number(val)), 'Omzet']} contentStyle={{ borderRadius: '12px', border: '1px solid oklch(0.9 0.01 250)', fontSize: 12 }} />
              <Area type="monotone" dataKey="revenue" stroke="oklch(0.55 0.22 264)" strokeWidth={2.5} fill="url(#revenueGrad)" dot={false} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      )}

      {/* Orderan per jam (hari ini) */}
      <Card>
        <CardHeader className="flex-row items-start justify-between pb-4">
          <div>
            <CardTitle>Orderan per Jam — Hari Ini</CardTitle>
            <CardDescription>Jumlah transaksi tiap jam{r.peakToday.orders > 0 ? ` · tersibuk jam ${r.peakToday.hour}.00 (${r.peakToday.orders} orderan)` : ''}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={r.hourlyToday} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 250)" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'oklch(0.6 0.01 250)' }} axisLine={false} tickLine={false} interval={1} />
              <YAxis tick={{ fontSize: 11, fill: 'oklch(0.6 0.01 250)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip formatter={(val: unknown, n: unknown) => n === 'orders' ? [`${val} orderan`, 'Orderan'] : [formatRupiah(Number(val)), 'Omzet']} contentStyle={{ borderRadius: '12px', border: '1px solid oklch(0.9 0.01 250)', fontSize: 12 }} labelFormatter={(l) => `Jam ${l}.00`} />
              <Bar dataKey="orders" fill="oklch(0.55 0.22 264)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-1.5"><Trophy size={16} className="text-amber-500" /> Produk Terlaris</CardTitle>
              {canSeeRevenue && <Link href="/dashboard/penjualan/laporan"><Button variant="ghost" size="sm" className="text-xs gap-1"><Eye size={13} /> Lihat Semua</Button></Link>}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {r.top.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Belum ada penjualan</p>}
            {r.top.map((p, i) => (
              <div key={p.name + i}>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `oklch(0.55 0.22 264 / ${0.15 - i * 0.02})` }}>
                    <Package size={15} style={{ color: 'oklch(0.55 0.22 264)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${p.pct}%`, background: 'oklch(0.55 0.22 264)' }} />
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{p.sold} terjual</span>
                    </div>
                  </div>
                  {canSeeRevenue && <span className="text-sm font-semibold shrink-0">{formatRupiah(p.rev)}</span>}
                </div>
                {i < r.top.length - 1 && <Separator className="mt-3" />}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><AlertTriangle size={16} className="text-amber-500" /> Perhatian Stok</CardTitle>
              <Link href="/dashboard/inventori"><Button variant="ghost" size="sm" className="text-xs gap-1"><Plus size={13} /> Tambah Stok</Button></Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {r.low.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Semua stok aman</p>}
            {r.low.map((item, i) => (
              <div key={item.id}>
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${item.status === 'out' ? 'bg-destructive' : 'bg-amber-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.sku} · {item.cat}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${item.status === 'out' ? 'text-destructive' : 'text-amber-500'}`}>
                      {item.stock} {item.status === 'out' ? 'HABIS' : 'sisa'}
                    </p>
                    <p className="text-xs text-muted-foreground">Min: {item.min}</p>
                  </div>
                </div>
                {i < r.low.length - 1 && <Separator className="mt-3" />}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {canSeeRevenue && (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Transaksi Terbaru</CardTitle>
            <Link href="/dashboard/penjualan"><Button variant="ghost" size="sm" className="text-xs">Lihat Semua</Button></Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['No. Transaksi', 'Pelanggan', 'Total', 'Metode', 'Waktu', 'Status'].map((h) => (
                    <th key={h} className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.recent.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Belum ada transaksi</td></tr>
                )}
                {r.recent.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/50 transition-colors" style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="py-3 px-3 font-mono text-xs font-medium">{t.transaction_number}</td>
                    <td className="py-3 px-3 text-sm">{t.customer?.name ?? 'Pelanggan Umum'}</td>
                    <td className="py-3 px-3 font-semibold">{formatRupiah(t.total)}</td>
                    <td className="py-3 px-3"><Badge variant="secondary" className="text-xs">{PAYMENT_LABELS[t.payment_method] ?? t.payment_method}</Badge></td>
                    <td className="py-3 px-3 text-xs text-muted-foreground">{formatDateTime(t.created_at)}</td>
                    <td className="py-3 px-3">
                      <Badge variant="outline" className={`text-xs ${t.status === 'completed' ? 'border-emerald-500 text-emerald-600' : t.status === 'pending' ? 'border-amber-400 text-amber-600' : 'border-destructive text-destructive'}`}>
                        {t.status === 'completed' ? 'Selesai' : t.status === 'pending' ? 'Pending' : t.status === 'void' ? 'Void' : 'Refund'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  )
}

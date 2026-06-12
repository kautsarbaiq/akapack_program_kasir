'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts'
import {
  TrendingUp, TrendingDown, ShoppingCart, Package,
  Users, DollarSign, AlertTriangle, ArrowUpRight,
  ArrowDownRight, Eye, Plus
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  mockDashboardStats, mockSalesChart, mockTopProducts,
  mockLowStockItems, mockTransactions
} from '@/lib/mock-data'
import { formatRupiah, formatNumber, formatDateTime } from '@/lib/utils'

export default function DashboardPage() {
  const stats = mockDashboardStats
  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Selamat Pagi' : now.getHours() < 17 ? 'Selamat Siang' : 'Selamat Sore'

  const kpiCards = [
    {
      title: 'Omzet Hari Ini',
      value: formatRupiah(stats.today_revenue),
      change: stats.revenue_change,
      icon: DollarSign,
      iconBg: 'oklch(0.55 0.22 264 / 0.1)',
      iconColor: 'oklch(0.55 0.22 264)',
    },
    {
      title: 'Jumlah Transaksi',
      value: formatNumber(stats.today_transactions),
      change: stats.transactions_change,
      icon: ShoppingCart,
      iconBg: 'oklch(0.65 0.18 160 / 0.1)',
      iconColor: 'oklch(0.55 0.18 160)',
    },
    {
      title: 'Produk Terjual',
      value: formatNumber(stats.today_items_sold),
      change: stats.items_change,
      icon: Package,
      iconBg: 'oklch(0.75 0.18 85 / 0.1)',
      iconColor: 'oklch(0.6 0.18 85)',
    },
    {
      title: 'Pelanggan Baru',
      value: formatNumber(stats.today_new_customers),
      change: stats.customers_change,
      icon: Users,
      iconBg: 'oklch(0.65 0.2 310 / 0.1)',
      iconColor: 'oklch(0.55 0.2 310)',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{greeting}, Andi! 👋</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} — Toko AKAPACK
          </p>
        </div>
        <Button size="sm" className="gap-2" style={{ background: 'oklch(0.55 0.22 264)' }}>
          <ShoppingCart size={15} /> Buka POS Kasir
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon
          const isPositive = card.change >= 0
          const TrendIcon = isPositive ? TrendingUp : TrendingDown
          return (
            <Card key={card.title} className="overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: card.iconBg }}>
                    <Icon size={20} style={{ color: card.iconColor }} />
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                    <TrendIcon size={12} />
                    {Math.abs(card.change)}%
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">{card.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{card.title}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="flex-row items-start justify-between pb-4">
          <div>
            <CardTitle>Grafik Penjualan</CardTitle>
            <CardDescription>Omzet dan jumlah transaksi per hari</CardDescription>
          </div>
          <Tabs defaultValue="30">
            <TabsList className="h-8">
              <TabsTrigger value="7" className="text-xs h-7 px-2.5">7 Hari</TabsTrigger>
              <TabsTrigger value="30" className="text-xs h-7 px-2.5">30 Hari</TabsTrigger>
              <TabsTrigger value="90" className="text-xs h-7 px-2.5">3 Bulan</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={mockSalesChart} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.55 0.22 264)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.55 0.22 264)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 250)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'oklch(0.6 0.01 250)' }} axisLine={false} tickLine={false} interval={4} />
              <YAxis tick={{ fontSize: 11, fill: 'oklch(0.6 0.01 250)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}jt`} />
              <Tooltip
                formatter={(val: unknown) => [formatRupiah(Number(val)), 'Omzet']}
                contentStyle={{ borderRadius: '12px', border: '1px solid oklch(0.9 0.01 250)', fontSize: 12 }}
              />
              <Area type="monotone" dataKey="revenue" stroke="oklch(0.55 0.22 264)" strokeWidth={2.5} fill="url(#revenueGrad)" dot={false} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Bottom Grid */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Top Products */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">🏆 Produk Terlaris</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs gap-1">
                <Eye size={13} /> Lihat Semua
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {mockTopProducts.map((p, i) => (
              <div key={p.product_id}>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `oklch(0.55 0.22 264 / ${0.15 - i * 0.02})` }}>
                    <Package size={15} style={{ color: 'oklch(0.55 0.22 264)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.product_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${p.percentage}%`, background: 'oklch(0.55 0.22 264)' }} />
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{p.total_sold} terjual</span>
                    </div>
                  </div>
                  <span className="text-sm font-semibold shrink-0">{formatRupiah(p.total_revenue)}</span>
                </div>
                {i < mockTopProducts.length - 1 && <Separator className="mt-3" />}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Low Stock Alert */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500" />
                Perhatian Stok
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs gap-1">
                <Plus size={13} /> Tambah Stok
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {mockLowStockItems.map((item, i) => (
              <div key={item.product_id}>
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${item.status === 'out' ? 'bg-destructive' : 'bg-amber-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.product_name}</p>
                    <p className="text-xs text-muted-foreground">{item.sku} · {item.category_name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${item.status === 'out' ? 'text-destructive' : 'text-amber-500'}`}>
                      {item.current_stock} {item.status === 'out' ? 'HABIS' : 'sisa'}
                    </p>
                    <p className="text-xs text-muted-foreground">Min: {item.min_stock}</p>
                  </div>
                </div>
                {i < mockLowStockItems.length - 1 && <Separator className="mt-3" />}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Transaksi Terbaru</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs">Lihat Semua</Button>
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
                {mockTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/50 transition-colors"
                    style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="py-3 px-3 font-mono text-xs font-medium">{t.transaction_number}</td>
                    <td className="py-3 px-3 text-sm">{t.customer?.name ?? 'Pelanggan Umum'}</td>
                    <td className="py-3 px-3 font-semibold">{formatRupiah(t.total)}</td>
                    <td className="py-3 px-3">
                      <Badge variant="secondary" className="text-xs capitalize">{t.payment_method}</Badge>
                    </td>
                    <td className="py-3 px-3 text-xs text-muted-foreground">{formatDateTime(t.created_at)}</td>
                    <td className="py-3 px-3">
                      <Badge variant="outline" className={`text-xs ${t.status === 'completed' ? 'border-emerald-500 text-emerald-600' : 'border-destructive text-destructive'}`}>
                        {t.status === 'completed' ? 'Selesai' : t.status === 'void' ? 'Void' : 'Refund'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

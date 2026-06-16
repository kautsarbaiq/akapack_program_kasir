'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { TrendingUp, ArrowLeft, Download } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useBooks } from '@/lib/use-books'
import { buildJournalEntries, computeLedger, ACC } from '@/lib/accounting'
import { formatRupiah, exportCsv } from '@/lib/utils'

const PERIODS = [
  { value: 'month', label: 'Bulan Ini' },
  { value: 'year', label: 'Tahun Ini' },
  { value: 'all', label: 'Semua' },
] as const
type Period = (typeof PERIODS)[number]['value']

function startOf(period: Period): number {
  if (period === 'all') return 0
  const d = new Date()
  if (period === 'month') return new Date(d.getFullYear(), d.getMonth(), 1).getTime()
  return new Date(d.getFullYear(), 0, 1).getTime()
}

function Line({ label, value, muted, strong, accent, indent }: { label: string; value: number; muted?: boolean; strong?: boolean; accent?: boolean; indent?: boolean }) {
  return (
    <div className={`flex justify-between py-2 ${strong ? 'font-bold border-t' : ''}`} style={strong ? { borderColor: 'var(--border)' } : undefined}>
      <span className={`${indent ? 'pl-4' : ''} ${muted ? 'text-muted-foreground' : ''}`}>{label}</span>
      <span className={`tabular-nums ${accent ? 'text-emerald-600' : ''}`}>{formatRupiah(value)}</span>
    </div>
  )
}

export default function LabaRugiPage() {
  const { accounts, completed, manualEntries, costByProductId } = useBooks()
  const [period, setPeriod] = useState<Period>('month')

  const pl = useMemo(() => {
    const cutoff = startOf(period)
    const txns = completed.filter((t) => new Date(t.created_at).getTime() >= cutoff)
    const manual = manualEntries.filter((e) => new Date(e.date).getTime() >= cutoff)
    const entries = buildJournalEntries({ accounts, transactions: txns, manualEntries: manual, costByProductId })
    const ledger = computeLedger(accounts, entries)
    const byCode = new Map(ledger.map((r) => [r.account.code, r]))
    const bal = (code: string) => byCode.get(code)?.balance ?? 0

    const revenues = ledger.filter((r) => r.account.type === 'revenue' && r.balance !== 0)
    const grossRevenue = revenues.reduce((s, r) => s + r.balance, 0)
    const discount = bal(ACC.SALES_DISCOUNT)
    const netRevenue = grossRevenue - discount
    const cogs = bal(ACC.COGS)
    const grossProfit = netRevenue - cogs
    const opex = ledger.filter((r) => r.account.type === 'expense' && r.account.code !== ACC.COGS && r.account.code !== ACC.SALES_DISCOUNT && r.balance !== 0)
    const totalOpex = opex.reduce((s, r) => s + r.balance, 0)
    const netProfit = grossProfit - totalOpex
    return { revenues, grossRevenue, discount, netRevenue, cogs, grossProfit, opex, totalOpex, netProfit }
  }, [accounts, completed, manualEntries, costByProductId, period])

  const doExport = () => {
    const rows: (string | number)[][] = [['Laporan Laba Rugi', PERIODS.find((p) => p.value === period)?.label ?? ''], []]
    pl.revenues.forEach((r) => rows.push([r.account.name, r.balance]))
    if (pl.discount > 0) rows.push(['Diskon Penjualan', -pl.discount])
    rows.push(['Pendapatan Bersih', pl.netRevenue], ['HPP', -pl.cogs], ['Laba Kotor', pl.grossProfit], [])
    pl.opex.forEach((r) => rows.push([r.account.name, -r.balance]))
    rows.push(['Total Beban Operasional', -pl.totalOpex], ['Laba Bersih', pl.netProfit])
    exportCsv('laba-rugi', rows)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Link href="/dashboard/akuntansi" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1"><ArrowLeft size={13} /> Akuntansi</Link>
          <h1 className="text-2xl font-bold flex items-center gap-2"><TrendingUp size={22} /> Laporan Laba Rugi</h1>
          <p className="text-muted-foreground text-sm mt-1">Pendapatan dikurangi beban dalam periode</p>
        </div>
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <Button key={p.value} size="sm" variant={period === p.value ? 'default' : 'outline'}
              className={`text-xs ${period === p.value ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}`}
              onClick={() => setPeriod(p.value)}>{p.label}</Button>
          ))}
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={doExport}><Download size={13} /> CSV</Button>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardContent className="p-6 text-sm">
          <p className="font-semibold text-muted-foreground mb-1">Pendapatan</p>
          {pl.revenues.length === 0 && <p className="text-xs text-muted-foreground py-2 pl-4">Belum ada pendapatan pada periode ini</p>}
          {pl.revenues.map((r) => <Line key={r.account.id} label={r.account.name} value={r.balance} indent muted />)}
          {pl.discount > 0 && <Line label="Diskon Penjualan (−)" value={-pl.discount} indent muted />}
          <Line label="Pendapatan Bersih" value={pl.netRevenue} strong />

          <div className="h-3" />
          <p className="font-semibold text-muted-foreground mb-1">Harga Pokok Penjualan</p>
          <Line label="HPP" value={-pl.cogs} indent muted />
          <Line label="Laba Kotor" value={pl.grossProfit} strong accent />

          <div className="h-3" />
          <p className="font-semibold text-muted-foreground mb-1">Beban Operasional</p>
          {pl.opex.length === 0 && <p className="text-xs text-muted-foreground py-2 pl-4">Belum ada beban operasional. Catat lewat Jurnal Manual.</p>}
          {pl.opex.map((r) => <Line key={r.account.id} label={r.account.name} value={-r.balance} indent muted />)}
          <Line label="Total Beban Operasional" value={-pl.totalOpex} strong />

          <div className="mt-3 rounded-lg bg-primary/5 px-4 py-3 flex justify-between items-center">
            <span className="font-bold">Laba Bersih</span>
            <span className={`text-xl font-bold tabular-nums ${pl.netProfit >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>{formatRupiah(pl.netProfit)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

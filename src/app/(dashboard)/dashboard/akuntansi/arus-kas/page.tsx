'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Waves, ArrowLeft, Download } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useBooks } from '@/lib/use-books'
import { computeCashFlow, type CashFlowItem } from '@/lib/accounting'
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
  return period === 'month' ? new Date(d.getFullYear(), d.getMonth(), 1).getTime() : new Date(d.getFullYear(), 0, 1).getTime()
}

function Section({ title, items, total }: { title: string; items: CashFlowItem[]; total: number }) {
  return (
    <div>
      <p className="font-semibold text-muted-foreground mb-1">{title}</p>
      {items.length === 0 && <p className="text-xs text-muted-foreground py-1.5 pl-4">Tidak ada arus kas</p>}
      {items.map((i) => (
        <div key={i.label} className="flex justify-between py-1.5 pl-4">
          <span className="text-muted-foreground">{i.label}</span>
          <span className={`tabular-nums ${i.amount < 0 ? 'text-destructive' : ''}`}>{formatRupiah(i.amount)}</span>
        </div>
      ))}
      <div className="flex justify-between py-1.5 font-semibold border-t" style={{ borderColor: 'var(--border)' }}>
        <span>Kas Bersih {title}</span><span className="tabular-nums">{formatRupiah(total)}</span>
      </div>
    </div>
  )
}

export default function ArusKasPage() {
  const { accounts, entries } = useBooks()
  const [period, setPeriod] = useState<Period>('month')
  const cf = useMemo(() => computeCashFlow(accounts, entries, startOf(period)), [accounts, entries, period])

  const doExport = () => {
    const rows: (string | number)[][] = [['Arus Kas', PERIODS.find((p) => p.value === period)?.label ?? '']]
    rows.push([])
    const add = (title: string, items: CashFlowItem[], total: number) => {
      rows.push([title])
      items.forEach((i) => rows.push([i.label, i.amount]))
      rows.push([`Kas Bersih ${title}`, total])
      rows.push([])
    }
    add('Operasional', cf.operating, cf.totalOperating)
    add('Investasi', cf.investing, cf.totalInvesting)
    add('Pendanaan', cf.financing, cf.totalFinancing)
    rows.push(['Kas Awal', cf.beginningCash], ['Perubahan Kas', cf.netChange], ['Kas Akhir', cf.endingCash])
    exportCsv('arus-kas', rows)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Link href="/dashboard/akuntansi" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1"><ArrowLeft size={13} /> Akuntansi</Link>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Waves size={22} /> Laporan Arus Kas</h1>
          <p className="text-muted-foreground text-sm mt-1">Pergerakan Kas & Bank — operasional, investasi, pendanaan</p>
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
        <CardContent className="p-6 text-sm space-y-4">
          <Section title="Operasional" items={cf.operating} total={cf.totalOperating} />
          <Section title="Investasi" items={cf.investing} total={cf.totalInvesting} />
          <Section title="Pendanaan" items={cf.financing} total={cf.totalFinancing} />
          <div className="rounded-lg bg-muted/40 px-4 py-3 space-y-1.5">
            <div className="flex justify-between"><span className="text-muted-foreground">Kas Awal Periode</span><span className="tabular-nums">{formatRupiah(cf.beginningCash)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Perubahan Kas</span><span className={`tabular-nums ${cf.netChange < 0 ? 'text-destructive' : 'text-emerald-600'}`}>{formatRupiah(cf.netChange)}</span></div>
            <div className="flex justify-between font-bold border-t pt-1.5" style={{ borderColor: 'var(--border)' }}><span>Kas Akhir</span><span className="tabular-nums">{formatRupiah(cf.endingCash)}</span></div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

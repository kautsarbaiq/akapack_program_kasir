'use client'

import Link from 'next/link'
import { Scale, ArrowLeft, CheckCircle2, AlertTriangle, Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useBooks } from '@/lib/use-books'
import { formatRupiah, exportCsv } from '@/lib/utils'
import type { LedgerRow } from '@/lib/accounting'

function Row({ label, value, strong, accent }: { label: string; value: number; strong?: boolean; accent?: boolean }) {
  return (
    <div className={`flex justify-between py-2 ${strong ? 'font-bold border-t mt-1' : ''}`} style={strong ? { borderColor: 'var(--border)' } : undefined}>
      <span className={strong ? '' : 'text-muted-foreground'}>{label}</span>
      <span className={`tabular-nums ${accent ? 'text-emerald-600' : ''}`}>{formatRupiah(value)}</span>
    </div>
  )
}

const visible = (rows: LedgerRow[]) => rows.filter((r) => r.balance !== 0)

export default function NeracaPage() {
  const { balanceSheet: bs } = useBooks()

  const doExport = () => {
    const rows: (string | number)[][] = [['Neraca'], [], ['ASET']]
    visible(bs.assets).forEach((r) => rows.push([r.account.name, r.balance]))
    rows.push(['Total Aset', bs.totalAssets], [], ['KEWAJIBAN'])
    visible(bs.liabilities).forEach((r) => rows.push([r.account.name, r.balance]))
    rows.push(['Total Kewajiban', bs.totalLiabilities], [], ['EKUITAS'])
    visible(bs.equity).forEach((r) => rows.push([r.account.name, r.balance]))
    rows.push(['Laba Berjalan', bs.netProfit], ['Total Ekuitas', bs.totalEquity], [], ['Total Kewajiban + Ekuitas', bs.totalLiabilities + bs.totalEquity])
    exportCsv('neraca', rows)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Link href="/dashboard/akuntansi" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1"><ArrowLeft size={13} /> Akuntansi</Link>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Scale size={22} /> Neraca</h1>
          <p className="text-muted-foreground text-sm mt-1">Posisi keuangan saat ini — Aset = Kewajiban + Ekuitas</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={doExport}><Download size={13} /> CSV</Button>
      </div>

      <Card className={bs.balanced ? 'border-emerald-200' : 'border-amber-200'}>
        <CardContent className="p-4 flex items-center gap-3 text-sm">
          {bs.balanced
            ? <><CheckCircle2 size={18} className="text-emerald-600 shrink-0" /><span>Neraca <strong>seimbang</strong>.</span></>
            : <><AlertTriangle size={18} className="text-amber-500 shrink-0" /><span>Selisih {formatRupiah(Math.abs(bs.totalAssets - (bs.totalLiabilities + bs.totalEquity)))} — periksa saldo awal akun.</span></>}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Aset</CardTitle></CardHeader>
          <CardContent className="text-sm pt-0">
            {visible(bs.assets).map((r) => <Row key={r.account.id} label={r.account.name} value={r.balance} />)}
            <Row label="Total Aset" value={bs.totalAssets} strong accent />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Kewajiban & Ekuitas</CardTitle></CardHeader>
          <CardContent className="text-sm pt-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-1 mb-1">Kewajiban</p>
            {visible(bs.liabilities).map((r) => <Row key={r.account.id} label={r.account.name} value={r.balance} />)}
            <Row label="Total Kewajiban" value={bs.totalLiabilities} strong />

            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-4 mb-1">Ekuitas</p>
            {visible(bs.equity).map((r) => <Row key={r.account.id} label={r.account.name} value={r.balance} />)}
            <Row label="Laba Berjalan" value={bs.netProfit} />
            <Row label="Total Ekuitas" value={bs.totalEquity} strong />

            <Row label="Total Kewajiban + Ekuitas" value={bs.totalLiabilities + bs.totalEquity} strong accent />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Scale, ArrowLeft, Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useBooks } from '@/lib/use-books'
import { computeAging, type Aging } from '@/lib/accounting'
import { formatRupiah, formatDate, exportCsv } from '@/lib/utils'

function AgingTable({ title, aging, emptyHint }: { title: string; aging: Aging; emptyHint: string }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          <span className="text-lg font-bold tabular-nums">{formatRupiah(aging.total)}</span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-4 gap-2 mb-4">
          {aging.buckets.map((b) => (
            <div key={b.label} className="rounded-lg border bg-muted/20 p-2 text-center">
              <p className="text-[11px] text-muted-foreground">{b.label} hari</p>
              <p className="text-sm font-semibold tabular-nums">{formatRupiah(b.amount)}</p>
            </div>
          ))}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Tanggal', 'Nomor', 'Keterangan', 'Umur', 'Saldo'].map((h, i) => (
                <th key={h} className={`py-2 px-2 text-xs font-semibold text-muted-foreground ${i >= 3 ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {aging.items.map((it, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td className="py-2 px-2 text-xs text-muted-foreground">{formatDate(it.date)}</td>
                <td className="py-2 px-2 font-mono text-xs">{it.number}</td>
                <td className="py-2 px-2">{it.description}</td>
                <td className="py-2 px-2 text-right"><Badge variant="outline" className="text-[11px]">{it.ageDays}h</Badge></td>
                <td className="py-2 px-2 text-right tabular-nums font-medium">{formatRupiah(it.amount)}</td>
              </tr>
            ))}
            {aging.items.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-xs text-muted-foreground">{emptyHint}</td></tr>}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

export default function PiutangHutangPage() {
  const { accounts, entries, ledger } = useBooks()
  const asOf = Date.now()

  const piutang = useMemo(() => computeAging(accounts, entries, '1-120', asOf), [accounts, entries, asOf])
  const hutang = useMemo(() => computeAging(accounts, entries, '2-100', asOf), [accounts, entries, asOf])
  const ppn = ledger.find((r) => r.account.code === '2-200')?.balance ?? 0

  const doExport = () => {
    const rows: (string | number)[][] = [['Jenis', 'Tanggal', 'Nomor', 'Keterangan', 'Umur (hari)', 'Saldo']]
    piutang.items.forEach((it) => rows.push(['Piutang', it.date.slice(0, 10), it.number, it.description, it.ageDays, it.amount]))
    hutang.items.forEach((it) => rows.push(['Hutang', it.date.slice(0, 10), it.number, it.description, it.ageDays, it.amount]))
    exportCsv('piutang-hutang', rows)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Link href="/dashboard/akuntansi" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1"><ArrowLeft size={13} /> Akuntansi</Link>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Scale size={22} /> Piutang & Hutang</h1>
          <p className="text-muted-foreground text-sm mt-1">Umur piutang/hutang (pelunasan FIFO) · Hutang PPN: <span className="font-medium text-foreground">{formatRupiah(ppn)}</span></p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={doExport}><Download size={13} /> CSV</Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <AgingTable title="Piutang Usaha" aging={piutang} emptyHint="Tidak ada piutang berjalan. Catat penjualan kredit lewat Jurnal Manual (Debit Piutang Usaha)." />
        <AgingTable title="Hutang Usaha" aging={hutang} emptyHint="Tidak ada hutang berjalan. Catat pembelian tempo lewat Jurnal Manual (Kredit Hutang Usaha)." />
      </div>
    </div>
  )
}

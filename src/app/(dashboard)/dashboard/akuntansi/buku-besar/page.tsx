'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Wallet, ArrowLeft, Download } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useBooks } from '@/lib/use-books'
import { normalBalance, ACCOUNT_TYPE_LABEL } from '@/lib/accounting'
import { formatRupiah, formatDate, exportCsv } from '@/lib/utils'

export default function BukuBesarPage() {
  const { accounts, entries } = useBooks()
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')

  const account = accounts.find((a) => a.id === accountId) ?? accounts[0]

  const rows = useMemo(() => {
    if (!account) return []
    const debitNormal = normalBalance(account.type) === 'debit'
    const mutations = entries
      .map((e) => {
        const l = e.lines.find((x) => x.account_id === account.id)
        if (!l) return null
        return { date: e.date, number: e.number, description: e.description, debit: l.debit, credit: l.credit }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.date.localeCompare(b.date))

    let running = 0
    return mutations.map((m) => {
      running += debitNormal ? m.debit - m.credit : m.credit - m.debit
      return { ...m, balance: running }
    })
  }, [account, entries])

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0)
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0)
  const endBalance = rows.length ? rows[rows.length - 1].balance : 0

  const doExport = () => {
    const head: (string | number)[][] = [[`Buku Besar: ${account?.code ?? ''} ${account?.name ?? ''}`], [], ['Tanggal', 'Nomor', 'Keterangan', 'Debit', 'Kredit', 'Saldo']]
    rows.forEach((m) => head.push([m.date.slice(0, 10), m.number, m.description, m.debit, m.credit, m.balance]))
    head.push(['', '', 'Total', totalDebit, totalCredit, endBalance])
    exportCsv(`buku-besar-${account?.code ?? 'akun'}`, head)
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/akuntansi" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1"><ArrowLeft size={13} /> Akuntansi</Link>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet size={22} /> Buku Besar</h1>
        <p className="text-muted-foreground text-sm mt-1">Mutasi debit/kredit & saldo berjalan per akun</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-[260px]">
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
        </select>
        {account && <span className="text-xs text-muted-foreground">Tipe: {ACCOUNT_TYPE_LABEL[account.type]} · saldo normal {normalBalance(account.type) === 'debit' ? 'Debit' : 'Kredit'}</span>}
        <Button size="sm" variant="outline" className="gap-1.5 text-xs ml-auto" onClick={doExport}><Download size={13} /> CSV</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50" style={{ borderBottom: '1px solid var(--border)' }}>
                {['Tanggal', 'Nomor', 'Keterangan', 'Debit', 'Kredit', 'Saldo'].map((h, i) => (
                  <th key={h} className={`py-3 px-4 text-xs font-semibold text-muted-foreground ${i >= 3 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((m, i) => (
                <tr key={i} className="hover:bg-muted/30" style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="py-2.5 px-4 text-xs text-muted-foreground">{formatDate(m.date)}</td>
                  <td className="py-2.5 px-4 font-mono text-xs">{m.number}</td>
                  <td className="py-2.5 px-4">{m.description}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums">{m.debit > 0 ? formatRupiah(m.debit) : '—'}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">{m.credit > 0 ? formatRupiah(m.credit) : '—'}</td>
                  <td className="py-2.5 px-4 text-right tabular-nums font-semibold">{formatRupiah(m.balance)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">Belum ada mutasi untuk akun ini</td></tr>}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="bg-muted/40 font-semibold">
                  <td colSpan={3} className="py-3 px-4 text-right">Total</td>
                  <td className="py-3 px-4 text-right tabular-nums">{formatRupiah(totalDebit)}</td>
                  <td className="py-3 px-4 text-right tabular-nums">{formatRupiah(totalCredit)}</td>
                  <td className="py-3 px-4 text-right tabular-nums text-primary">{formatRupiah(endBalance)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

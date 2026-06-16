'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Lock, Unlock, ArrowLeft, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useBooks } from '@/lib/use-books'
import { useClosingStore } from '@/stores/use-closing-store'
import { buildJournalEntries, computeLedger, computeProfitLoss } from '@/lib/accounting'
import { formatRupiah, formatDate } from '@/lib/utils'
import { toast } from 'sonner'

export default function TutupBukuPage() {
  const { accounts, completed, manualEntries, costByProductId } = useBooks()
  const closedUntil = useClosingStore((s) => s.closedUntil)
  const close = useClosingStore((s) => s.close)
  const reopen = useClosingStore((s) => s.reopen)

  const [date, setDate] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 0).toISOString().slice(0, 10) // akhir bulan lalu
  })

  const summary = useMemo(() => {
    const end = new Date(date).getTime() + 86400000 - 1
    const txns = completed.filter((t) => new Date(t.created_at).getTime() <= end)
    const manual = manualEntries.filter((e) => new Date(e.date).getTime() <= end)
    const entries = buildJournalEntries({ accounts, transactions: txns, manualEntries: manual, costByProductId })
    return computeProfitLoss(computeLedger(accounts, entries))
  }, [accounts, completed, manualEntries, costByProductId, date])

  const doClose = () => {
    if (closedUntil && new Date(date) <= new Date(closedUntil)) { toast.error('Tanggal tutup harus setelah periode yang sudah dikunci'); return }
    close(date)
    toast.success(`Buku ditutup s/d ${formatDate(date)}. Jurnal manual sebelum tanggal ini dikunci.`)
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/akuntansi" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1"><ArrowLeft size={13} /> Akuntansi</Link>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Lock size={22} /> Tutup Buku</h1>
        <p className="text-muted-foreground text-sm mt-1">Kunci periode agar jurnal lama tidak berubah & laba masuk Laba Ditahan</p>
      </div>

      <Card className={closedUntil ? 'border-emerald-200' : ''}>
        <CardContent className="p-4 flex items-center gap-3 text-sm">
          {closedUntil ? (
            <>
              <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
              <span className="flex-1">Buku terkunci s/d <strong>{formatDate(closedUntil)}</strong>. Jurnal manual bertanggal ≤ ini ditolak.</span>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { reopen(); toast.success('Periode dibuka kembali') }}><Unlock size={13} /> Buka Kembali</Button>
            </>
          ) : (
            <><Unlock size={18} className="text-muted-foreground shrink-0" /><span>Belum ada periode yang dikunci.</span></>
          )}
        </CardContent>
      </Card>

      <Card className="max-w-xl">
        <CardHeader><CardTitle className="text-base">Tutup Buku per Tanggal</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-2 max-w-xs">
            <Label>Tanggal Tutup</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="rounded-lg bg-muted/40 p-4 space-y-1.5">
            <div className="flex justify-between"><span className="text-muted-foreground">Total Pendapatan (s/d {formatDate(date)})</span><span className="tabular-nums">{formatRupiah(summary.totalRevenue)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total Beban</span><span className="tabular-nums text-destructive">−{formatRupiah(summary.totalExpense)}</span></div>
            <div className="flex justify-between font-bold border-t pt-1.5" style={{ borderColor: 'var(--border)' }}>
              <span>Laba Bersih → Laba Ditahan</span>
              <span className={`tabular-nums ${summary.netProfit >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>{formatRupiah(summary.netProfit)}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Catatan: AKAPACK menghitung laba per periode secara otomatis — laba bersih sudah otomatis tampil di Ekuitas (Neraca) sebagai &quot;Laba Berjalan&quot;. Tutup buku di sini mengunci jurnal periode agar tidak berubah.
          </p>
          <Button onClick={doClose} className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"><Lock size={15} /> Kunci Periode s/d {formatDate(date)}</Button>
        </CardContent>
      </Card>
    </div>
  )
}

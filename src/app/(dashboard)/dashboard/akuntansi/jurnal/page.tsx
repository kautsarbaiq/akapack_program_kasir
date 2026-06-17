'use client'

import { useState, useMemo, Fragment } from 'react'
import Link from 'next/link'
import { Plus, Trash2, ScrollText, ArrowLeft, ChevronDown, ChevronRight, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useBooks } from '@/lib/use-books'
import { useJournalStore } from '@/stores/use-journal-store'
import { useAccountStore } from '@/stores/use-account-store'
import { useClosingStore } from '@/stores/use-closing-store'
import { formatRupiah, formatDate } from '@/lib/utils'
import type { JournalEntry, JournalLine, JournalSource } from '@/types'
import { toast } from 'sonner'

const SOURCE_BADGE: Record<JournalSource, { label: string; cls: string }> = {
  opening: { label: 'Saldo Awal', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  pos: { label: 'POS', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  online: { label: 'Online', cls: 'bg-violet-100 text-violet-700 border-violet-200' },
  purchase: { label: 'Pembelian', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  manual: { label: 'Manual', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
}

const entryTotal = (e: JournalEntry) => e.lines.reduce((s, l) => s + l.debit, 0)

function genNumber() {
  const d = new Date()
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, '')
  return `JV-${ymd}-${Math.floor(Math.random() * 900 + 100)}`
}

type DraftLine = { account_id: string; debit: number; credit: number }

export default function JurnalPage() {
  const { entries } = useBooks()
  const accounts = useAccountStore((s) => s.accounts)
  const addEntry = useJournalStore((s) => s.addEntry)
  const deleteEntry = useJournalStore((s) => s.deleteEntry)
  const closedUntil = useClosingStore((s) => s.closedUntil)

  const [filter, setFilter] = useState<'all' | JournalSource>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState(false)

  // form jurnal manual
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [desc, setDesc] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([{ account_id: '', debit: 0, credit: 0 }, { account_id: '', debit: 0, credit: 0 }])

  const list = useMemo(() => {
    const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date))
    return filter === 'all' ? sorted : sorted.filter((e) => e.source === filter)
  }, [entries, filter])

  const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0)
  const balanced = totalDebit > 0 && totalDebit === totalCredit

  const toggle = (id: string) => setExpanded((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const setLine = (i: number, patch: Partial<DraftLine>) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  const addLine = () => setLines((ls) => [...ls, { account_id: '', debit: 0, credit: 0 }])
  const removeLine = (i: number) => setLines((ls) => (ls.length <= 2 ? ls : ls.filter((_, idx) => idx !== i)))

  const openNew = () => {
    setDate(new Date().toISOString().slice(0, 10)); setDesc('')
    setLines([{ account_id: '', debit: 0, credit: 0 }, { account_id: '', debit: 0, credit: 0 }])
    setOpen(true)
  }

  const save = () => {
    if (!desc.trim()) { toast.error('Keterangan wajib diisi'); return }
    if (closedUntil && new Date(date) <= new Date(closedUntil)) { toast.error(`Periode s/d ${closedUntil} sudah ditutup. Pilih tanggal setelahnya.`); return }
    const used = lines.filter((l) => l.account_id && (l.debit > 0 || l.credit > 0))
    if (used.length < 2) { toast.error('Minimal 2 baris akun terisi'); return }
    if (!balanced) { toast.error('Total debit harus sama dengan total kredit'); return }
    const jlines: JournalLine[] = used.map((l) => {
      const a = accounts.find((x) => x.id === l.account_id)
      return { account_id: l.account_id, account_code: a?.code, account_name: a?.name, debit: l.debit || 0, credit: l.credit || 0 }
    })
    const entry: JournalEntry = {
      id: `manual-${Date.now()}`,
      number: genNumber(),
      date: new Date(date).toISOString(),
      description: desc.trim(),
      source: 'manual',
      lines: jlines,
      created_at: new Date().toISOString(),
    }
    addEntry(entry)
    toast.success('Jurnal manual disimpan')
    setOpen(false)
  }

  const FILTERS: { value: 'all' | JournalSource; label: string }[] = [
    { value: 'all', label: 'Semua' }, { value: 'pos', label: 'POS' }, { value: 'online', label: 'Online' }, { value: 'purchase', label: 'Pembelian' }, { value: 'manual', label: 'Manual' }, { value: 'opening', label: 'Saldo Awal' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/dashboard/akuntansi" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1"><ArrowLeft size={13} /> Akuntansi</Link>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ScrollText size={22} /> Jurnal Umum</h1>
          <p className="text-muted-foreground text-sm mt-1">{entries.length} jurnal · transaksi POS/online otomatis terjurnal</p>
        </div>
        <Button onClick={openNew} className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"><Plus size={16} /> Jurnal Manual</Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <Button key={f.value} size="sm" variant={filter === f.value ? 'default' : 'outline'}
            className={`text-xs ${filter === f.value ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}`}
            onClick={() => setFilter(f.value)}>{f.label}</Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50" style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="w-8"></th>
                {['Nomor', 'Tanggal', 'Keterangan', 'Sumber', 'Nilai', ''].map((h) => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((e) => {
                const isOpen = expanded.has(e.id)
                const badge = SOURCE_BADGE[e.source]
                return (
                  <Fragment key={e.id}>
                    <tr className="hover:bg-muted/30 cursor-pointer" style={{ borderBottom: '1px solid var(--border)' }} onClick={() => toggle(e.id)}>
                      <td className="pl-3 text-muted-foreground">{isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</td>
                      <td className="py-3 px-4 font-mono text-xs font-semibold">{e.number}</td>
                      <td className="py-3 px-4 text-muted-foreground text-xs">{formatDate(e.date)}</td>
                      <td className="py-3 px-4">{e.description}</td>
                      <td className="py-3 px-4"><Badge variant="outline" className={`text-xs ${badge.cls}`}>{badge.label}</Badge></td>
                      <td className="py-3 px-4 font-semibold tabular-nums">{formatRupiah(entryTotal(e))}</td>
                      <td className="py-3 px-3 text-right">
                        {e.source === 'manual' && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={(ev) => { ev.stopPropagation(); if (confirm('Hapus jurnal manual ini?')) { deleteEntry(e.id); toast.success('Jurnal dihapus') } }}><Trash2 size={13} /></Button>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <td></td>
                        <td colSpan={6} className="px-4 pb-3">
                          <div className="rounded-lg border bg-muted/20 overflow-hidden">
                            {e.lines.map((l, i) => (
                              <div key={i} className="flex items-center text-xs py-1.5 px-3" style={{ borderBottom: i < e.lines.length - 1 ? '1px solid var(--border)' : undefined }}>
                                <span className="font-mono text-muted-foreground w-16">{l.account_code}</span>
                                <span className="flex-1">{l.account_name}</span>
                                <span className="w-32 text-right tabular-nums">{l.debit > 0 ? formatRupiah(l.debit) : '—'}</span>
                                <span className="w-32 text-right tabular-nums text-muted-foreground">{l.credit > 0 ? formatRupiah(l.credit) : '—'}</span>
                              </div>
                            ))}
                            <div className="flex items-center text-xs py-1.5 px-3 font-semibold bg-muted/40">
                              <span className="flex-1">Total</span>
                              <span className="w-32 text-right tabular-nums">{formatRupiah(e.lines.reduce((s, l) => s + l.debit, 0))}</span>
                              <span className="w-32 text-right tabular-nums">{formatRupiah(e.lines.reduce((s, l) => s + l.credit, 0))}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
              {list.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">Belum ada jurnal</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Dialog Jurnal Manual */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Jurnal Manual</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>Tanggal</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
              <div className="col-span-2 space-y-2"><Label>Keterangan *</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Mis. Bayar listrik bulan Juni" /></div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center text-xs font-semibold text-muted-foreground px-1">
                <span className="flex-1">Akun</span><span className="w-32 text-right">Debit</span><span className="w-32 text-right">Kredit</span><span className="w-8"></span>
              </div>
              {lines.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select value={l.account_id} onChange={(e) => setLine(i, { account_id: e.target.value })}
                    className="flex-1 h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">— pilih akun —</option>
                    {accounts.filter((a) => a.is_active).map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
                  </select>
                  <Input type="number" className="w-32 text-right" value={l.debit || ''} placeholder="0"
                    onChange={(e) => setLine(i, { debit: Number(e.target.value), credit: 0 })} />
                  <Input type="number" className="w-32 text-right" value={l.credit || ''} placeholder="0"
                    onChange={(e) => setLine(i, { credit: Number(e.target.value), debit: 0 })} />
                  <button type="button" onClick={() => removeLine(i)} className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-destructive disabled:opacity-30" disabled={lines.length <= 2}><X size={14} /></button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs" onClick={addLine}><Plus size={13} /> Tambah Baris</Button>
            </div>

            <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${balanced ? 'bg-emerald-50 text-emerald-700' : 'bg-muted'}`}>
              <span>Total Debit: <strong className="tabular-nums">{formatRupiah(totalDebit)}</strong></span>
              <span>Total Kredit: <strong className="tabular-nums">{formatRupiah(totalCredit)}</strong></span>
              <span className="font-semibold">{balanced ? 'Seimbang' : `Selisih ${formatRupiah(Math.abs(totalDebit - totalCredit))}`}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} disabled={!balanced} className="bg-primary text-primary-foreground hover:bg-primary/90">Simpan Jurnal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

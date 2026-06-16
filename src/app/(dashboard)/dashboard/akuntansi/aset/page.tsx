'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Boxes, ArrowLeft, Plus, Pencil, Trash2, ReceiptText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useAssetStore, type AssetInput } from '@/stores/use-asset-store'
import { useJournalStore } from '@/stores/use-journal-store'
import { useAccountStore } from '@/stores/use-account-store'
import { depreciation } from '@/lib/accounting'
import { formatRupiah, formatDate } from '@/lib/utils'
import type { Asset, JournalEntry } from '@/types'
import { toast } from 'sonner'

const EMPTY: AssetInput = { name: '', category: 'Mesin', acquired_at: new Date().toISOString().slice(0, 10), cost: 0, salvage: 0, useful_life_months: 60, is_active: true }

function Kpi({ title, value }: { title: string; value: string }) {
  return <Card><CardContent className="p-4"><p className="text-xl font-bold tabular-nums">{value}</p><p className="text-xs text-muted-foreground mt-0.5">{title}</p></CardContent></Card>
}

export default function AsetPage() {
  const assets = useAssetStore((s) => s.assets)
  const addAsset = useAssetStore((s) => s.addAsset)
  const updateAsset = useAssetStore((s) => s.updateAsset)
  const deleteAsset = useAssetStore((s) => s.deleteAsset)
  const accounts = useAccountStore((s) => s.accounts)
  const manualEntries = useJournalStore((s) => s.manualEntries)
  const addEntry = useJournalStore((s) => s.addEntry)

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Asset | null>(null)
  const [form, setForm] = useState<AssetInput>(EMPTY)

  const now = new Date()
  const rows = assets.map((a) => ({ a, dep: depreciation(a, now) }))
  const totalCost = assets.reduce((s, a) => s + a.cost, 0)
  const totalAccum = rows.reduce((s, r) => s + r.dep.accumulated, 0)
  const totalBook = totalCost - totalAccum
  const monthlyTotal = rows.filter((r) => r.a.is_active).reduce((s, r) => s + r.dep.monthly, 0)

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true) }
  const openEdit = (a: Asset) => { setEditing(a); setForm({ name: a.name, category: a.category, acquired_at: a.acquired_at.slice(0, 10), cost: a.cost, salvage: a.salvage, useful_life_months: a.useful_life_months, is_active: a.is_active }); setOpen(true) }
  const save = () => {
    if (!form.name.trim() || form.cost <= 0) { toast.error('Nama & harga perolehan wajib diisi'); return }
    if (editing) { updateAsset(editing.id, form); toast.success('Aset diperbarui') }
    else { addAsset(form); toast.success('Aset ditambahkan') }
    setOpen(false)
  }
  const remove = (a: Asset) => { if (confirm(`Hapus aset "${a.name}"?`)) { deleteAsset(a.id); toast.success('Aset dihapus') } }

  const postDepreciation = () => {
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
    const number = `DEP-${ym}`
    if (manualEntries.some((e) => e.number === number)) { toast.error('Penyusutan bulan ini sudah dicatat'); return }
    if (monthlyTotal <= 0) { toast.error('Tidak ada penyusutan untuk dicatat'); return }
    const exp = accounts.find((a) => a.code === '5-340')
    const accum = accounts.find((a) => a.code === '1-210')
    if (!exp || !accum) { toast.error('Akun penyusutan (5-340 / 1-210) tidak ditemukan'); return }
    const entry: JournalEntry = {
      id: `manual-${Date.now()}`,
      number,
      date: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString(),
      description: `Penyusutan aset ${now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`,
      source: 'manual',
      lines: [
        { account_id: exp.id, account_code: exp.code, account_name: exp.name, debit: monthlyTotal, credit: 0 },
        { account_id: accum.id, account_code: accum.code, account_name: accum.name, debit: 0, credit: monthlyTotal },
      ],
      created_at: new Date().toISOString(),
    }
    addEntry(entry)
    toast.success(`Penyusutan ${formatRupiah(monthlyTotal)} dicatat ke jurnal`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Link href="/dashboard/akuntansi" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1"><ArrowLeft size={13} /> Akuntansi</Link>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Boxes size={22} /> Aset & Penyusutan</h1>
          <p className="text-muted-foreground text-sm mt-1">Penyusutan garis lurus · {assets.length} aset</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={postDepreciation}><ReceiptText size={14} /> Catat Penyusutan Bulan Ini</Button>
          <Button size="sm" onClick={openNew} className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"><Plus size={15} /> Tambah Aset</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi title="Total Perolehan" value={formatRupiah(totalCost)} />
        <Kpi title="Akm. Penyusutan (s/d kini)" value={formatRupiah(totalAccum)} />
        <Kpi title="Nilai Buku" value={formatRupiah(totalBook)} />
        <Kpi title="Penyusutan / Bulan" value={formatRupiah(monthlyTotal)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50" style={{ borderBottom: '1px solid var(--border)' }}>
                {['Aset', 'Perolehan', 'Harga', 'Umur', 'Penyusutan/bln', 'Akm.', 'Nilai Buku', ''].map((h, i) => (
                  <th key={h} className={`py-3 px-3 text-xs font-semibold text-muted-foreground ${i >= 2 && i <= 6 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ a, dep }) => (
                <tr key={a.id} className="hover:bg-muted/30 group" style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="py-2.5 px-3"><p className="font-medium">{a.name}{!a.is_active && <span className="ml-1.5 text-xs text-muted-foreground">(nonaktif)</span>}</p><p className="text-xs text-muted-foreground">{a.category}</p></td>
                  <td className="py-2.5 px-3 text-xs text-muted-foreground">{formatDate(a.acquired_at)}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{formatRupiah(a.cost)}</td>
                  <td className="py-2.5 px-3 text-right text-xs text-muted-foreground">{a.useful_life_months} bln</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{formatRupiah(dep.monthly)}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">{formatRupiah(dep.accumulated)}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-semibold">{formatRupiah(dep.bookValue)}</td>
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)}><Pencil size={13} /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => remove(a)}><Trash2 size={13} /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {assets.length === 0 && <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">Belum ada aset</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Edit Aset' : 'Tambah Aset'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nama Aset *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mesin Cetak Plastik" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Kategori</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Mesin" /></div>
              <div className="space-y-2"><Label>Tgl Perolehan</Label><Input type="date" value={form.acquired_at} onChange={(e) => setForm({ ...form, acquired_at: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Harga Perolehan</Label><Input type="number" value={form.cost || ''} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} /></div>
              <div className="space-y-2"><Label>Nilai Residu</Label><Input type="number" value={form.salvage || ''} onChange={(e) => setForm({ ...form, salvage: Number(e.target.value) })} /></div>
            </div>
            <div className="space-y-2"><Label>Umur Manfaat (bulan)</Label><Input type="number" value={form.useful_life_months || ''} onChange={(e) => setForm({ ...form, useful_life_months: Number(e.target.value) })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} className="bg-primary text-primary-foreground hover:bg-primary/90">{editing ? 'Simpan' : 'Tambah'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

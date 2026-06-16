'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Pencil, Trash2, BookOpen, ArrowLeft } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useAccountStore, type AccountInput } from '@/stores/use-account-store'
import { useBooks } from '@/lib/use-books'
import { ACCOUNT_TYPE_LABEL, ACCOUNT_TYPE_ORDER } from '@/lib/accounting'
import { formatRupiah } from '@/lib/utils'
import type { Account, AccountType } from '@/types'
import { toast } from 'sonner'

const EMPTY: AccountInput = { code: '', name: '', type: 'asset', opening_balance: 0, description: '', is_active: true }

export default function DaftarAkunPage() {
  const addAccount = useAccountStore((s) => s.addAccount)
  const updateAccount = useAccountStore((s) => s.updateAccount)
  const deleteAccount = useAccountStore((s) => s.deleteAccount)
  const { ledger } = useBooks()

  const balById = useMemo(() => new Map(ledger.map((r) => [r.account.id, r.balance])), [ledger])
  const grouped = useMemo(
    () => ACCOUNT_TYPE_ORDER.map((type) => ({ type, rows: ledger.filter((r) => r.account.type === type) })),
    [ledger]
  )

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [form, setForm] = useState<AccountInput>(EMPTY)

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true) }
  const openEdit = (a: Account) => {
    setEditing(a)
    setForm({ code: a.code, name: a.name, type: a.type, opening_balance: a.opening_balance, description: a.description ?? '', is_active: a.is_active })
    setOpen(true)
  }

  const save = () => {
    if (!form.code.trim() || !form.name.trim()) { toast.error('Kode & nama akun wajib diisi'); return }
    if (editing) { updateAccount(editing.id, form); toast.success('Akun diperbarui') }
    else { addAccount(form); toast.success('Akun ditambahkan') }
    setOpen(false)
  }

  const remove = (a: Account) => {
    if (confirm(`Hapus akun "${a.code} ${a.name}"? Jurnal yang sudah memakainya tidak ikut terhapus.`)) {
      deleteAccount(a.id); toast.success('Akun dihapus')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/dashboard/akuntansi" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1"><ArrowLeft size={13} /> Akuntansi</Link>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen size={22} /> Daftar Akun</h1>
          <p className="text-muted-foreground text-sm mt-1">Chart of Accounts — {ledger.length} akun. Saldo dihitung dari saldo awal + jurnal.</p>
        </div>
        <Button onClick={openNew} className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"><Plus size={16} /> Tambah Akun</Button>
      </div>

      {grouped.map(({ type, rows }) => (
        <Card key={type}>
          <CardContent className="p-0">
            <div className="px-4 py-2.5 bg-muted/50 font-semibold text-sm flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
              <span>{ACCOUNT_TYPE_LABEL[type as AccountType]}</span>
              <span className="text-muted-foreground font-mono text-xs">{formatRupiah(rows.reduce((s, r) => s + r.balance, 0))}</span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {rows.map((r) => (
                  <tr key={r.account.id} className="hover:bg-muted/30 group" style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="py-2.5 px-4 font-mono text-xs text-muted-foreground w-20">{r.account.code}</td>
                    <td className="py-2.5 px-4 font-medium">{r.account.name}{!r.account.is_active && <span className="ml-2 text-xs text-muted-foreground">(nonaktif)</span>}</td>
                    <td className="py-2.5 px-4 text-right font-semibold tabular-nums">{formatRupiah(r.balance)}</td>
                    <td className="py-2.5 px-3 w-20">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r.account)}><Pencil size={13} /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => remove(r.account)}><Trash2 size={13} /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={4} className="py-4 px-4 text-center text-xs text-muted-foreground">Belum ada akun</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Edit Akun' : 'Tambah Akun'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>Kode *</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="1-100" /></div>
              <div className="col-span-2 space-y-2"><Label>Nama Akun *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Kas" /></div>
            </div>
            <div className="space-y-2">
              <Label>Tipe</Label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as AccountType })}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {ACCOUNT_TYPE_ORDER.map((t) => <option key={t} value={t}>{ACCOUNT_TYPE_LABEL[t]}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Saldo Awal</Label>
              <Input type="number" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: Number(e.target.value) })} />
            </div>
            <div className="space-y-2"><Label>Keterangan (opsional)</Label><Input value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
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

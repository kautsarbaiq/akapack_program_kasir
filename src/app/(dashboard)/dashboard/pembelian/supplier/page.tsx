'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Pencil, Trash2, Truck, ArrowLeft, Phone, Mail, MapPin } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useSupplierStore, type SupplierInput } from '@/stores/use-supplier-store'
import type { Supplier } from '@/types'
import { toast } from 'sonner'

const EMPTY: SupplierInput = { name: '', phone: '', email: '', address: '', is_active: true }

export default function SupplierPage() {
  const suppliers = useSupplierStore((s) => s.suppliers)
  const addSupplier = useSupplierStore((s) => s.addSupplier)
  const updateSupplier = useSupplierStore((s) => s.updateSupplier)
  const deleteSupplier = useSupplierStore((s) => s.deleteSupplier)

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState<SupplierInput>(EMPTY)

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true) }
  const openEdit = (s: Supplier) => { setEditing(s); setForm({ name: s.name, phone: s.phone ?? '', email: s.email ?? '', address: s.address ?? '', is_active: s.is_active }); setOpen(true) }
  const save = () => {
    if (!form.name.trim()) { toast.error('Nama supplier wajib diisi'); return }
    if (editing) { updateSupplier(editing.id, form); toast.success('Supplier diperbarui') }
    else { addSupplier(form); toast.success('Supplier ditambahkan') }
    setOpen(false)
  }
  const remove = (s: Supplier) => { if (confirm(`Hapus supplier "${s.name}"?`)) { deleteSupplier(s.id); toast.success('Supplier dihapus') } }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/dashboard/pembelian" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1"><ArrowLeft size={13} /> Pembelian</Link>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Truck size={22} /> Supplier</h1>
          <p className="text-muted-foreground text-sm mt-1">{suppliers.length} supplier terdaftar</p>
        </div>
        <Button onClick={openNew} className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"><Plus size={16} /> Tambah Supplier</Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {suppliers.map((s) => (
          <Card key={s.id} className="group">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <p className="font-semibold">{s.name}{!s.is_active && <span className="ml-1.5 text-xs text-muted-foreground">(nonaktif)</span>}</p>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}><Pencil size={13} /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => remove(s)}><Trash2 size={13} /></Button>
                </div>
              </div>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                {s.phone && <div className="flex items-center gap-1.5"><Phone size={12} /> {s.phone}</div>}
                {s.email && <div className="flex items-center gap-1.5"><Mail size={12} /> {s.email}</div>}
                {s.address && <div className="flex items-start gap-1.5"><MapPin size={12} className="mt-0.5" /> {s.address}</div>}
              </div>
            </CardContent>
          </Card>
        ))}
        {suppliers.length === 0 && <p className="col-span-full text-center text-muted-foreground py-12">Belum ada supplier</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Edit Supplier' : 'Tambah Supplier'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nama Supplier *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="CV Plastik Jaya" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Telepon</Label><Input value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0812xxxx" /></div>
              <div className="space-y-2"><Label>Email</Label><Input value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="sales@..." /></div>
            </div>
            <div className="space-y-2"><Label>Alamat</Label><Input value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
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

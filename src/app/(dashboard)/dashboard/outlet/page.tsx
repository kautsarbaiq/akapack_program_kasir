'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, Store, Phone, MapPin, CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useOutletStore, type OutletInput } from '@/stores/use-outlet-store'
import { useActiveOutletStore } from '@/stores/use-active-outlet-store'
import { useInventoryStore } from '@/stores/use-inventory-store'
import type { Outlet } from '@/types'
import { toast } from 'sonner'

const EMPTY: OutletInput = { name: '', address: '', phone: '', email: '', is_active: true }

export default function OutletPage() {
  const outlets = useOutletStore((s) => s.outlets)
  const addOutlet = useOutletStore((s) => s.addOutlet)
  const updateOutlet = useOutletStore((s) => s.updateOutlet)
  const deleteOutlet = useOutletStore((s) => s.deleteOutlet)
  const activeOutletId = useActiveOutletStore((s) => s.activeOutletId)

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Outlet | null>(null)
  const [form, setForm] = useState<OutletInput>(EMPTY)

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true) }
  const openEdit = (o: Outlet) => { setEditing(o); setForm({ name: o.name, address: o.address, phone: o.phone ?? '', email: o.email ?? '', is_active: o.is_active }); setOpen(true) }
  const save = () => {
    if (!form.name.trim()) { toast.error('Nama outlet wajib diisi'); return }
    if (editing) { updateOutlet(editing.id, form); toast.success('Outlet diperbarui') }
    else { addOutlet(form); toast.success('Outlet ditambahkan') }
    setOpen(false)
  }
  const remove = (o: Outlet) => {
    if (o.id === activeOutletId) { toast.error('Tidak bisa menghapus outlet yang sedang aktif'); return }
    if (outlets.length <= 1) { toast.error('Minimal harus ada 1 outlet'); return }
    if (confirm(`Hapus outlet "${o.name}"? Stok cabang ini akan ikut terhapus.`)) {
      useInventoryStore.getState().removeByOutlet(o.id)
      deleteOutlet(o.id)
      toast.success('Outlet dihapus')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Store size={22} /> Outlet / Cabang</h1>
          <p className="text-muted-foreground text-sm mt-1">{outlets.length} outlet · stok dikelola terpisah per cabang. Ganti outlet aktif dari header.</p>
        </div>
        <Button onClick={openNew} className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"><Plus size={16} /> Tambah Outlet</Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {outlets.map((o) => (
          <Card key={o.id} className={`group ${o.id === activeOutletId ? 'border-primary/50' : ''}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{o.name}</p>
                  {o.id === activeOutletId && <span className="inline-flex items-center gap-1 text-xs text-primary"><CheckCircle2 size={12} /> Aktif</span>}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(o)}><Pencil size={13} /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => remove(o)}><Trash2 size={13} /></Button>
                </div>
              </div>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                {o.address && <div className="flex items-start gap-1.5"><MapPin size={12} className="mt-0.5" /> {o.address}</div>}
                {o.phone && <div className="flex items-center gap-1.5"><Phone size={12} /> {o.phone}</div>}
                {!o.is_active && <span className="text-amber-600">Nonaktif</span>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Edit Outlet' : 'Tambah Outlet'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nama Outlet *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Cabang 3" /></div>
            <div className="space-y-2"><Label>Alamat</Label><Input value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Telepon</Label><Input value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="space-y-2"><Label>Email</Label><Input value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
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

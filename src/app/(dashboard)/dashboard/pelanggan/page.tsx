'use client'

import { useState } from 'react'
import { Plus, Search, Phone, Mail, Gift, Eye } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { useCustomerStore } from '@/stores/use-customer-store'
import { CustomerFormDialog } from '@/components/dashboard/customer-form-dialog'
import { formatRupiah, formatDate, getInitials, getAvatarColor, rankedSearch } from '@/lib/utils'
import type { Customer } from '@/types'
import { toast } from 'sonner'

export default function PelangganPage() {
  const customers = useCustomerStore((s) => s.customers)
  const addPoints = useCustomerStore((s) => s.addPoints)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Customer | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Customer | null>(null)

  const filtered = rankedSearch(customers, search, (c) => [c.name, c.phone, c.email], (c) => c.name)

  const totalCustomers = customers.length
  const totalPoints = customers.reduce((s, c) => s + c.points, 0)
  const avgSpend = Math.round(customers.reduce((s, c) => s + c.total_spent, 0) / (customers.length || 1))

  const handleAddPoints = (cust: Customer) => {
    const input = window.prompt(`Tambah poin untuk ${cust.name}:`, '100')
    if (input === null) return
    const n = Number(input)
    if (!Number.isFinite(n) || n <= 0) { toast.error('Jumlah poin tidak valid'); return }
    addPoints(cust.id, n)
    setSelected({ ...cust, points: cust.points + n })
    toast.success(`+${n} poin untuk ${cust.name}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Database Pelanggan</h1>
          <p className="text-muted-foreground text-sm mt-1">Kelola data dan loyalitas pelanggan Anda</p>
        </div>
        <Button size="sm" className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => { setEditTarget(null); setFormOpen(true) }}>
          <Plus size={15} /> Tambah Pelanggan
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Pelanggan', value: totalCustomers },
          { label: 'Total Poin Beredar', value: totalPoints.toLocaleString('id-ID') },
          { label: 'Rata-rata Spending', value: formatRupiah(avgSpend), small: true },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className={`font-bold ${s.small ? 'text-xl' : 'text-2xl'}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Cari nama, HP, email..." className="pl-9 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50" style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Pelanggan', 'HP', 'Total Transaksi', 'Total Spending', 'Poin', 'Bergabung', 'Aksi'].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors" style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className={`text-xs font-bold text-white ${getAvatarColor(c.name)}`}>
                            {getInitials(c.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{c.name}</p>
                          {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{c.phone ?? '-'}</td>
                    <td className="py-3 px-4">{c.total_transactions}x</td>
                    <td className="py-3 px-4 font-semibold">{formatRupiah(c.total_spent)}</td>
                    <td className="py-3 px-4">
                      <Badge className="text-xs gap-1 bg-blue-50 text-blue-700 border-blue-200">
                        <Gift size={10} />{c.points.toLocaleString('id-ID')}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">{formatDate(c.member_since)}</td>
                    <td className="py-3 px-4">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelected(c)}>
                        <Eye size={13} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="overflow-y-auto">
          {selected && (
            <>
              <SheetHeader className="pb-5">
                <SheetTitle>Detail Pelanggan</SheetTitle>
              </SheetHeader>
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className={`text-xl font-bold text-white ${getAvatarColor(selected.name)}`}>
                      {getInitials(selected.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-bold">{selected.name}</h3>
                    <p className="text-sm text-muted-foreground">Member sejak {formatDate(selected.member_since)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Total Transaksi', value: `${selected.total_transactions}x` },
                    { label: 'Total Spending', value: formatRupiah(selected.total_spent) },
                    { label: 'Poin Reward', value: `${selected.points.toLocaleString('id-ID')} poin` },
                    { label: 'Avg. Transaksi', value: formatRupiah(Math.round(selected.total_spent / (selected.total_transactions || 1))) },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl p-3 bg-muted/50">
                      <p className="text-sm font-bold">{s.value}</p>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-2">
                  {selected.phone && <div className="flex items-center gap-2 text-sm"><Phone size={14} className="text-muted-foreground" />{selected.phone}</div>}
                  {selected.email && <div className="flex items-center gap-2 text-sm"><Mail size={14} className="text-muted-foreground" />{selected.email}</div>}
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1"
                    onClick={() => { setEditTarget(selected); setFormOpen(true); setSelected(null) }}>
                    Edit Data
                  </Button>
                  <Button className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => selected && handleAddPoints(selected)}>
                    + Tambah Poin
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <CustomerFormDialog open={formOpen} onOpenChange={setFormOpen} customer={editTarget} />
    </div>
  )
}

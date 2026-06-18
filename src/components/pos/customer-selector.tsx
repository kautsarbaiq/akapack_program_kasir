'use client'

import { useState } from 'react'
import { Search, UserPlus, UserX, Check } from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useCustomerStore } from '@/stores/use-customer-store'
import { CustomerFormDialog } from '@/components/dashboard/customer-form-dialog'
import { getInitials, getAvatarColor, rankedSearch } from '@/lib/utils'
import type { Customer } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedId?: string | null
  onSelect: (customer: Customer | null) => void
}

export function CustomerSelector({ open, onOpenChange, selectedId, onSelect }: Props) {
  const customers = useCustomerStore((s) => s.customers)
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)

  const filtered = rankedSearch(customers, search, (c) => [c.name, c.phone], (c) => c.name)

  const pick = (c: Customer | null) => {
    onSelect(c)
    onOpenChange(false)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="overflow-hidden flex flex-col p-0 w-full sm:max-w-sm">
          <SheetHeader className="p-4 pb-2">
            <SheetTitle>Pilih Pelanggan</SheetTitle>
          </SheetHeader>

          <div className="px-4 pb-3 space-y-2">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Cari nama / HP..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-1.5" onClick={() => pick(null)}>
                <UserX size={15} /> Umum
              </Button>
              <Button className="flex-1 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setAddOpen(true)}>
                <UserPlus size={15} /> Pelanggan Baru
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1 px-4 pb-4">
            <div className="space-y-1">
              {filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => pick(c)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted text-left transition-colors"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className={`text-xs font-bold text-white ${getAvatarColor(c.name)}`}>{getInitials(c.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.phone ?? 'Tanpa nomor'}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0">{c.points} poin</Badge>
                  {selectedId === c.id && <Check size={16} className="text-primary shrink-0" />}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">Tidak ada pelanggan ditemukan</p>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <CustomerFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSuccess={() => {
          // store menaruh pelanggan baru di indeks 0
          const newest = useCustomerStore.getState().customers[0]
          if (newest) pick(newest)
        }}
      />
    </>
  )
}

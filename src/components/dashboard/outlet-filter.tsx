'use client'

import { Store } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useOutletStore } from '@/stores/use-outlet-store'

/**
 * Dropdown filter cabang untuk halaman laporan/riwayat.
 * value 'all' = semua cabang; selain itu = id outlet tertentu.
 * Beda dari OutletSwitcher (yang mengubah outlet AKTIF global + proyeksi stok) —
 * ini hanya filter tampilan data di satu halaman.
 */
export function OutletFilter({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const outlets = useOutletStore((s) => s.outlets)
  return (
    <Select value={value} onValueChange={(v) => { if (v) onChange(v) }}>
      <SelectTrigger className={className ?? 'w-48 h-9 text-sm'}>
        <Store size={14} className="text-muted-foreground shrink-0" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Semua Cabang</SelectItem>
        {outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

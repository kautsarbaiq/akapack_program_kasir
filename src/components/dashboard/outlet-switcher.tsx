'use client'

import { Store, ChevronDown, Check } from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useOutletStore } from '@/stores/use-outlet-store'
import { useActiveOutletStore } from '@/stores/use-active-outlet-store'
import { useProductStore } from '@/stores/use-product-store'
import { useVariantStore } from '@/stores/use-variant-store'
import { useCurrentUserStore } from '@/stores/use-current-user-store'

/** Pemilih cabang/outlet aktif. Ganti cabang → proyeksikan ulang stok produk/varian.
 *  Karyawan (cashier) terkunci ke cabangnya → tampil label statis tanpa dropdown. */
export function OutletSwitcher({ className }: { className?: string }) {
  const outlets = useOutletStore((s) => s.outlets)
  const activeOutletId = useActiveOutletStore((s) => s.activeOutletId)
  const setActiveOutlet = useActiveOutletStore((s) => s.setActiveOutlet)
  const role = useCurrentUserStore((s) => (s.user?.role || '').toLowerCase())
  const locked = role !== 'owner' && role !== 'manager'
  const active = outlets.find((o) => o.id === activeOutletId) ?? outlets[0]

  const switchOutlet = (id: string) => {
    if (id === activeOutletId) return
    setActiveOutlet(id)
    useProductStore.getState().projectStock(id)
    useVariantStore.getState().projectVariantStock(id)
    toast.success(`Cabang aktif: ${outlets.find((o) => o.id === id)?.name ?? ''}`)
  }

  if (outlets.length === 0) return null

  // Karyawan: cabang terkunci — label statis, tak bisa ganti.
  if (locked) {
    return (
      <div className={cn('inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm shrink-0', className)} title="Cabang terkunci untuk karyawan">
        <Store size={15} className="text-primary shrink-0" />
        <span className="max-w-[140px] truncate">{active?.name ?? 'Cabang'}</span>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(
        'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm shrink-0 outline-none transition-colors',
        'hover:bg-muted data-[state=open]:bg-muted',
        className
      )}>
        <Store size={15} className="text-primary shrink-0" />
        <span className="max-w-[140px] truncate">{active?.name ?? 'Cabang'}</span>
        <ChevronDown size={13} className="opacity-60 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Pilih Cabang</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {outlets.map((o) => (
          <DropdownMenuItem key={o.id} className="flex items-center justify-between cursor-pointer" onClick={() => switchOutlet(o.id)}>
            <span className="truncate">{o.name}</span>
            {o.id === activeOutletId && <Check size={14} className="text-primary shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

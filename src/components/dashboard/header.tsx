'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Menu, Bell, Search, ChevronDown, Store, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { cn, getInitials, getAvatarColor } from '@/lib/utils'
import { getSupabaseBrowser } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { useOutletStore } from '@/stores/use-outlet-store'
import { useActiveOutletStore } from '@/stores/use-active-outlet-store'
import { useCurrentUserStore } from '@/stores/use-current-user-store'
import { useProductStore } from '@/stores/use-product-store'
import { useVariantStore } from '@/stores/use-variant-store'

interface HeaderProps {
  onMenuClick: () => void
  sidebarOpen: boolean
}

const breadcrumbMap: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/produk': 'Produk › Katalog',
  '/dashboard/produk/kategori': 'Produk › Kategori',
  '/dashboard/produk/import': 'Produk › Import',
  '/dashboard/inventori': 'Inventori › Stok',
  '/dashboard/inventori/pergerakan': 'Inventori › Pergerakan',
  '/dashboard/inventori/opname': 'Inventori › Stock Opname',
  '/dashboard/penjualan': 'Penjualan › Transaksi',
  '/dashboard/penjualan/laporan': 'Penjualan › Laporan',
  '/dashboard/pelanggan': 'Pelanggan',
  '/dashboard/promosi': 'Promosi',
  '/dashboard/karyawan': 'Karyawan',
  '/dashboard/laporan': 'Laporan',
  '/dashboard/pengaturan': 'Pengaturan',
}

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const pageTitle = breadcrumbMap[pathname] ?? 'Dashboard'

  const outlets = useOutletStore((s) => s.outlets)
  const activeOutletId = useActiveOutletStore((s) => s.activeOutletId)
  const setActiveOutlet = useActiveOutletStore((s) => s.setActiveOutlet)
  const activeOutlet = outlets.find((o) => o.id === activeOutletId) ?? outlets[0]
  const products = useProductStore((s) => s.products)
  const currentUser = useCurrentUserStore((s) => s.user)
  const displayName = currentUser?.name ?? 'Pengguna'
  const displayEmail = currentUser?.email ?? ''
  const roleLabel = currentUser?.role ? currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1) : 'Pengguna'

  const switchOutlet = (id: string) => {
    setActiveOutlet(id)
    // Proyeksikan ulang stok produk/varian ke outlet yang dipilih
    useProductStore.getState().projectStock(id)
    useVariantStore.getState().projectVariantStock(id)
    toast.success(`Outlet aktif: ${outlets.find((o) => o.id === id)?.name ?? ''}`)
  }

  const handleLogout = async () => {
    if (isSupabaseConfigured()) {
      await getSupabaseBrowser().auth.signOut()
      toast.success('Berhasil keluar')
    }
    router.push('/login')
    router.refresh()
  }

  // Notifikasi nyata: produk aktif yang stoknya habis/menipis (≤ min stok)
  const lowStock = products.filter((p) => p.is_active && p.stock <= p.min_stock)
  const notifications = lowStock.slice(0, 12).map((p) => ({
    id: p.id,
    text: p.stock <= 0 ? `Stok habis: ${p.name}` : `Stok menipis: ${p.name} (${p.stock} ${p.unit})`,
    urgent: p.stock <= 0,
  }))

  return (
    <header className="flex h-16 items-center gap-4 px-4 lg:px-6 shrink-0 bg-background"
      style={{ borderBottom: '1px solid var(--border)' }}>

      {/* Toggle sidebar */}
      <Button variant="ghost" size="icon" onClick={onMenuClick} className="shrink-0">
        <Menu size={20} />
      </Button>

      {/* Page title / breadcrumb */}
      <div className="hidden lg:block">
        <p className="text-sm font-semibold text-foreground">{pageTitle}</p>
      </div>

      {/* Outlet switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 h-9 shrink-0" title={activeOutlet?.name ?? 'Outlet'}>
            <Store size={15} className="text-primary" />
            <span className="max-w-[120px] truncate">{activeOutlet?.name ?? 'Outlet'}</span>
            <ChevronDown size={13} className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Pilih Outlet</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {outlets.map((o) => (
            <DropdownMenuItem key={o.id} className="flex items-center justify-between cursor-pointer" onClick={() => switchOutlet(o.id)}>
              <span>{o.name}</span>
              {o.id === activeOutletId && <Check size={14} className="text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Search */}
      <div className="flex-1 max-w-md hidden md:block">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari produk, transaksi, pelanggan..."
            className="pl-9 h-9 bg-muted/50 border-transparent focus:bg-background focus:border-border"
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Status koneksi backend — hijau = terhubung Supabase (data online & tersinkron antar perangkat),
            kuning = mode demo lokal (build tanpa kredензial). */}
        <span
          title={isSupabaseConfigured() ? 'Terhubung ke server — data online & tersinkron' : 'Mode demo: tidak terhubung server (data lokal saja)'}
          className={cn(
            'hidden sm:flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium border',
            isSupabaseConfigured() ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
          )}>
          <span className={cn('w-1.5 h-1.5 rounded-full', isSupabaseConfigured() ? 'bg-emerald-500' : 'bg-amber-500')} />
          {isSupabaseConfigured() ? 'Online' : 'Demo'}
        </span>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell size={19} />
              {notifications.filter((n) => n.urgent).length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-xs font-bold rounded-full bg-destructive text-white flex items-center justify-center">
                  {notifications.filter((n) => n.urgent).length}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              Notifikasi
              <Badge variant="secondary" className="text-xs">{notifications.length}</Badge>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">Tidak ada notifikasi</div>
            ) : notifications.map((n) => (
              <DropdownMenuItem key={n.id} className="flex items-start gap-2 py-2.5 cursor-pointer">
                <span className={cn('mt-1 w-2 h-2 rounded-full shrink-0', n.urgent ? 'bg-destructive' : 'bg-amber-400')} />
                <p className={cn('text-sm flex-1', n.urgent ? 'font-medium' : 'text-muted-foreground')}>{n.text}</p>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 h-9 px-3">
              <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0', getAvatarColor(displayName))}>
                {getInitials(displayName)}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold leading-none">{displayName}</p>
                <p className="text-xs text-muted-foreground leading-none mt-0.5">{roleLabel}</p>
              </div>
              <ChevronDown size={14} className="text-muted-foreground hidden sm:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>
              <p className="font-semibold">{displayName}</p>
              <p className="text-xs text-muted-foreground font-normal">{displayEmail || roleLabel}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profil Saya</DropdownMenuItem>
            <DropdownMenuItem>Pengaturan</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleLogout}>
              Keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

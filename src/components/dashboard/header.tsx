'use client'

import { usePathname } from 'next/navigation'
import { Menu, Bell, Search, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

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

export function Header({ onMenuClick, sidebarOpen }: HeaderProps) {
  const pathname = usePathname()
  const pageTitle = breadcrumbMap[pathname] ?? 'Dashboard'

  const notifications = [
    { id: 1, text: 'Stok Powerbank 10000mAh habis', time: '5 mnt', urgent: true },
    { id: 2, text: 'Kopi Sachet Premium hampir habis (3 sisa)', time: '1 jam', urgent: true },
    { id: 3, text: 'Laporan harian siap diunduh', time: '2 jam', urgent: false },
  ]

  return (
    <header className="flex h-16 items-center gap-4 px-4 lg:px-6 shrink-0 bg-background"
      style={{ borderBottom: '1px solid var(--border)' }}>

      {/* Toggle sidebar */}
      <Button variant="ghost" size="icon" onClick={onMenuClick} className="shrink-0">
        <Menu size={20} />
      </Button>

      {/* Page title / breadcrumb */}
      <div className="hidden sm:block">
        <p className="text-sm font-semibold text-foreground">{pageTitle}</p>
      </div>

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
        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell size={19} />
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-xs font-bold rounded-full bg-destructive text-white flex items-center justify-center">
                {notifications.filter(n => n.urgent).length}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              Notifikasi
              <Badge variant="secondary" className="text-xs">{notifications.length}</Badge>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.map((n) => (
              <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-1 py-3 cursor-pointer">
                <div className="flex items-start gap-2 w-full">
                  {n.urgent && <span className="mt-0.5 w-2 h-2 rounded-full bg-destructive shrink-0" />}
                  <p className={cn('text-sm flex-1', n.urgent ? 'font-medium' : 'text-muted-foreground')}>{n.text}</p>
                </div>
                <span className="text-xs text-muted-foreground ml-4">{n.time} yang lalu</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 h-9 px-3">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ background: 'oklch(0.55 0.22 264)' }}>
                A
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold leading-none">Andi Wijaya</p>
                <p className="text-xs text-muted-foreground leading-none mt-0.5">Owner</p>
              </div>
              <ChevronDown size={14} className="text-muted-foreground hidden sm:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>
              <p className="font-semibold">Andi Wijaya</p>
              <p className="text-xs text-muted-foreground font-normal">andi@akapack.com</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profil Saya</DropdownMenuItem>
            <DropdownMenuItem>Pengaturan</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive">
              Keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, ShoppingCart, Package, Warehouse,
  Receipt, Users, Tag, UserCheck, BarChart3, Settings,
  ChevronDown, ChevronRight, LogOut, Store, X, ExternalLink, Calculator, Truck, CalendarCheck, FileText, FileSpreadsheet,
} from 'lucide-react'
import { cn, getInitials, getAvatarColor } from '@/lib/utils'
import { toast } from 'sonner'
import { useOutletStore } from '@/stores/use-outlet-store'
import { useActiveOutletStore } from '@/stores/use-active-outlet-store'
import { useCurrentUserStore } from '@/stores/use-current-user-store'
import { getSupabaseBrowser } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'

interface NavChild {
  title: string
  href: string
}

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  badge?: string
  badgeColor?: string
  children?: NavChild[]
}

const navItems: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  {
    title: 'POS Kasir', href: '/pos', icon: ShoppingCart,
    badge: 'LIVE', badgeColor: 'bg-emerald-500',
  },
  {
    title: 'Produk', href: '/dashboard/produk', icon: Package,
    children: [
      { title: 'Katalog Produk', href: '/dashboard/produk' },
      { title: 'Kategori', href: '/dashboard/produk/kategori' },
      { title: 'Import / Export', href: '/dashboard/produk/import' },
    ],
  },
  {
    title: 'Inventori', href: '/dashboard/inventori', icon: Warehouse,
    children: [
      { title: 'Stok Saat Ini', href: '/dashboard/inventori' },
      { title: 'Stok Masuk', href: '/dashboard/pembelian' },
      { title: 'Stok Keluar', href: '/dashboard/stok-keluar' },
      { title: 'Pergerakan Stok', href: '/dashboard/inventori/pergerakan' },
      { title: 'Stock Opname', href: '/dashboard/inventori/opname' },
      { title: 'Transfer Stok', href: '/dashboard/inventori/transfer' },
    ],
  },
  {
    title: 'Stok Masuk', href: '/dashboard/pembelian', icon: Truck,
    children: [
      { title: 'Daftar Stok Masuk', href: '/dashboard/pembelian' },
      { title: 'Stok Keluar', href: '/dashboard/stok-keluar' },
      { title: 'Supplier', href: '/dashboard/pembelian/supplier' },
    ],
  },
  {
    title: 'Penjualan', href: '/dashboard/penjualan', icon: Receipt,
    children: [
      { title: 'Riwayat Transaksi', href: '/dashboard/penjualan' },
      { title: 'Pesanan Online', href: '/dashboard/pesanan' },
      { title: 'Laporan Penjualan', href: '/dashboard/penjualan/laporan' },
    ],
  },
  { title: 'Surat Pesanan', href: '/dashboard/surat-pesanan', icon: FileText },
  { title: 'Penawaran', href: '/dashboard/penawaran', icon: FileSpreadsheet },
  {
    title: 'Akuntansi', href: '/dashboard/akuntansi', icon: Calculator,
    children: [
      { title: 'Ringkasan', href: '/dashboard/akuntansi' },
      { title: 'Daftar Akun', href: '/dashboard/akuntansi/akun' },
      { title: 'Jurnal', href: '/dashboard/akuntansi/jurnal' },
      { title: 'Buku Besar', href: '/dashboard/akuntansi/buku-besar' },
      { title: 'Laba Rugi', href: '/dashboard/akuntansi/laba-rugi' },
      { title: 'Neraca', href: '/dashboard/akuntansi/neraca' },
      { title: 'Arus Kas', href: '/dashboard/akuntansi/arus-kas' },
      { title: 'Piutang & Hutang', href: '/dashboard/akuntansi/piutang-hutang' },
      { title: 'Aset & Penyusutan', href: '/dashboard/akuntansi/aset' },
      { title: 'Tutup Buku', href: '/dashboard/akuntansi/tutup-buku' },
    ],
  },
  { title: 'Pelanggan', href: '/dashboard/pelanggan', icon: Users },
  {
    title: 'Promosi', href: '/dashboard/promosi', icon: Tag,
    children: [
      { title: 'Diskon & Promo', href: '/dashboard/promosi' },
      { title: 'Voucher', href: '/dashboard/promosi/voucher' },
    ],
  },
  {
    title: 'Karyawan', href: '/dashboard/karyawan', icon: UserCheck,
    children: [
      { title: 'Daftar Karyawan', href: '/dashboard/karyawan' },
      { title: 'Absensi', href: '/dashboard/karyawan/absensi' },
    ],
  },
  { title: 'Outlet', href: '/dashboard/outlet', icon: Store },
  { title: 'Laporan', href: '/dashboard/laporan', icon: BarChart3 },
]

const bottomItems: NavItem[] = [
  { title: 'Pengaturan', href: '/dashboard/pengaturan', icon: Settings },
]

// Menu khusus karyawan (role 'cashier'): POS Kasir, Riwayat Transaksi, Surat Pesanan (lihat), Absensi, Analisis Absensi, Stok (lihat).
const cashierNav: NavItem[] = [
  { title: 'POS Kasir', href: '/pos', icon: ShoppingCart, badge: 'LIVE', badgeColor: 'bg-emerald-500' },
  { title: 'Riwayat Transaksi', href: '/dashboard/penjualan', icon: Receipt },
  { title: 'Laporan Penjualan', href: '/dashboard/penjualan/laporan', icon: BarChart3 },
  { title: 'Surat Pesanan', href: '/dashboard/surat-pesanan', icon: FileText },
  { title: 'Penawaran', href: '/dashboard/penawaran', icon: FileSpreadsheet },
  { title: 'Absensi', href: '/dashboard/karyawan/absensi', icon: CalendarCheck },
  { title: 'Analisis Absensi', href: '/dashboard/karyawan/absensi/analisis', icon: BarChart3 },
  { title: 'Stok (Lihat)', href: '/dashboard/inventori', icon: Warehouse },
]

// Menu khusus SALES: Surat Pesanan (utama) + Absensi.
const salesNav: NavItem[] = [
  { title: 'Surat Pesanan', href: '/dashboard/surat-pesanan', icon: FileText },
  { title: 'Penawaran', href: '/dashboard/penawaran', icon: FileSpreadsheet },
  { title: 'Absensi', href: '/dashboard/karyawan/absensi', icon: CalendarCheck },
  { title: 'Analisis Absensi', href: '/dashboard/karyawan/absensi/analisis', icon: BarChart3 },
]

// Menu manager: input barang, cek stok, penjualan & laporan omzet (TANPA Akuntansi/laba/modal/edit-tx).
const managerNav: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'POS Kasir', href: '/pos', icon: ShoppingCart, badge: 'LIVE', badgeColor: 'bg-emerald-500' },
  {
    title: 'Produk', href: '/dashboard/produk', icon: Package,
    children: [
      { title: 'Katalog Produk', href: '/dashboard/produk' },
      { title: 'Kategori', href: '/dashboard/produk/kategori' },
      { title: 'Import / Export', href: '/dashboard/produk/import' },
    ],
  },
  {
    title: 'Inventori', href: '/dashboard/inventori', icon: Warehouse,
    children: [
      { title: 'Stok Saat Ini', href: '/dashboard/inventori' },
      { title: 'Stok Masuk', href: '/dashboard/pembelian' },
      { title: 'Stok Keluar', href: '/dashboard/stok-keluar' },
      { title: 'Pergerakan Stok', href: '/dashboard/inventori/pergerakan' },
      { title: 'Stock Opname', href: '/dashboard/inventori/opname' },
    ],
  },
  {
    title: 'Penjualan', href: '/dashboard/penjualan', icon: Receipt,
    children: [
      { title: 'Riwayat Transaksi', href: '/dashboard/penjualan' },
      { title: 'Laporan Penjualan', href: '/dashboard/penjualan/laporan' },
    ],
  },
  { title: 'Surat Pesanan', href: '/dashboard/surat-pesanan', icon: FileText },
  { title: 'Penawaran', href: '/dashboard/penawaran', icon: FileSpreadsheet },
  { title: 'Laporan', href: '/dashboard/laporan', icon: BarChart3 },
  { title: 'Absensi', href: '/dashboard/karyawan/absensi', icon: CalendarCheck },
  { title: 'Analisis Absensi', href: '/dashboard/karyawan/absensi/analisis', icon: UserCheck },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [expandedItems, setExpandedItems] = useState<string[]>(['Produk', 'Penjualan'])
  const outlets = useOutletStore((s) => s.outlets)
  const activeOutletId = useActiveOutletStore((s) => s.activeOutletId)
  const activeOutlet = outlets.find((o) => o.id === activeOutletId) ?? outlets[0]
  const currentUser = useCurrentUserStore((s) => s.user)
  const userName = currentUser?.name ?? 'Pengguna'
  const userRole = currentUser?.role ? currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1) : ''
  // Owner & manager lihat semua menu; karyawan (cashier/lainnya) hanya POS Kasir + Absensi.
  const role = (currentUser?.role || 'owner').toLowerCase()
  const isOwner = role === 'owner'
  const isManager = role === 'manager'
  const isPrivileged = isOwner || isManager
  const visibleNav = isOwner ? navItems : isManager ? managerNav : role === 'sales' ? salesNav : cashierNav
  const visibleBottom = isOwner ? bottomItems : [] // Pengaturan hanya owner

  const toggleExpand = (title: string) => {
    setExpandedItems((prev) =>
      prev.includes(title) ? prev.filter((i) => i !== title) : [...prev, title]
    )
  }

  // Hanya satu menu aktif: yang href-nya cocok paling spesifik (terpanjang).
  // Mencegah "Absensi" ikut menyala saat berada di "Analisis Absensi".
  const matchLen = (href: string) =>
    href === '/dashboard'
      ? (pathname === '/dashboard' ? href.length : -1)
      : (pathname === href || pathname.startsWith(href + '/') ? href.length : -1)
  let activeHref = ''
  let bestLen = 0
  for (const item of [...visibleNav, ...visibleBottom]) {
    const l = matchLen(item.href)
    if (l > bestLen) { bestLen = l; activeHref = item.href }
  }
  const isActive = (href: string) => bestLen > 0 && href === activeHref

  const logout = useCurrentUserStore((s) => s.logout)
  const handleLogout = async () => {
    await logout() // bersihkan sesi karyawan (PIN) & owner (Supabase)
    toast.success('Berhasil keluar')
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-30 h-full flex flex-col transition-all duration-300 ease-in-out',
          'lg:relative lg:z-auto',
          open ? 'w-64 translate-x-0' : 'w-64 -translate-x-full lg:w-16 lg:translate-x-0'
        )}
        style={{ background: 'oklch(0.13 0.03 256)', borderRight: '1px solid oklch(0.22 0.04 256)' }}
      >
        {/* Logo */}
        <div className="flex h-16 items-center px-4 shrink-0"
          style={{ borderBottom: '1px solid oklch(0.22 0.04 256)' }}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center font-bold text-sm text-white"
              style={{ background: 'oklch(0.55 0.22 264)' }}>
              A
            </div>
            <span className={cn(
              'font-bold text-base tracking-tight transition-all duration-300',
              open ? 'opacity-100 w-auto' : 'opacity-0 w-0 lg:opacity-0'
            )} style={{ color: 'oklch(0.92 0.01 250)' }}>
              AKAPACK
            </span>
          </div>

          {/* Close on mobile */}
          <button onClick={onClose} className="ml-auto lg:hidden text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Outlet info */}
        <div className={cn(
          'mx-3 mt-3 mb-1 px-3 py-2.5 rounded-xl transition-all duration-300',
          open ? 'opacity-100' : 'opacity-0 lg:opacity-0 h-0 overflow-hidden my-0 py-0'
        )} style={{ background: 'oklch(0.18 0.04 256)' }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'oklch(0.55 0.22 264 / 0.2)' }}>
              <Store size={14} style={{ color: 'oklch(0.65 0.2 264)' }} />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold truncate" style={{ color: 'oklch(0.88 0.01 250)' }}>{activeOutlet?.name ?? 'AKAPACK'}</p>
              <p className="text-xs truncate" style={{ color: 'oklch(0.5 0.02 250)' }}>{activeOutlet?.address || 'Outlet aktif'}</p>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {visibleNav.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            const expanded = expandedItems.includes(item.title)
            const hasChildren = item.children && item.children.length > 0

            return (
              <div key={item.title}>
                {hasChildren ? (
                  <button
                    onClick={() => open && toggleExpand(item.title)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left',
                      active
                        ? 'text-white'
                        : 'hover:text-white'
                    )}
                    style={{
                      color: active ? 'white' : 'oklch(0.6 0.02 250)',
                      background: active ? 'oklch(0.55 0.22 264)' : undefined,
                    }}
                    onMouseEnter={(e) => {
                      if (!active) (e.currentTarget as HTMLElement).style.background = 'oklch(0.2 0.04 256)'
                    }}
                    onMouseLeave={(e) => {
                      if (!active) (e.currentTarget as HTMLElement).style.background = ''
                    }}
                  >
                    <Icon size={18} className="shrink-0" />
                    <span className={cn('flex-1 transition-all duration-300 truncate', open ? 'opacity-100' : 'opacity-0 lg:opacity-0 w-0')}>{item.title}</span>
                    {open && (
                      expanded
                        ? <ChevronDown size={14} className="shrink-0 opacity-60" />
                        : <ChevronRight size={14} className="shrink-0 opacity-60" />
                    )}
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150'
                    )}
                    style={{
                      color: active ? 'white' : 'oklch(0.6 0.02 250)',
                      background: active ? 'oklch(0.55 0.22 264)' : undefined,
                    }}
                    onMouseEnter={(e) => {
                      if (!active) (e.currentTarget as HTMLElement).style.background = 'oklch(0.2 0.04 256)'
                      if (!active) (e.currentTarget as HTMLElement).style.color = 'white'
                    }}
                    onMouseLeave={(e) => {
                      if (!active) (e.currentTarget as HTMLElement).style.background = ''
                      if (!active) (e.currentTarget as HTMLElement).style.color = 'oklch(0.6 0.02 250)'
                    }}
                  >
                    <Icon size={18} className="shrink-0" />
                    <span className={cn('flex-1 transition-all duration-300 truncate', open ? 'opacity-100' : 'opacity-0 lg:opacity-0 w-0')}>{item.title}</span>
                    {item.badge && open && (
                      <span className={cn('text-xs px-1.5 py-0.5 rounded font-semibold text-white shrink-0', item.badgeColor)}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                )}

                {/* Children submenu */}
                {hasChildren && expanded && open && (
                  <div className="ml-9 mt-0.5 space-y-0.5">
                    {item.children!.map((child) => {
                      const childActive = pathname === child.href
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className="block px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150"
                          style={{
                            color: childActive ? 'oklch(0.7 0.2 264)' : 'oklch(0.55 0.02 250)',
                            background: childActive ? 'oklch(0.55 0.22 264 / 0.15)' : undefined,
                          }}
                          onMouseEnter={(e) => {
                            if (!childActive) (e.currentTarget as HTMLElement).style.color = 'oklch(0.88 0.01 250)'
                          }}
                          onMouseLeave={(e) => {
                            if (!childActive) (e.currentTarget as HTMLElement).style.color = 'oklch(0.55 0.02 250)'
                          }}
                        >
                          {child.title}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Bottom section */}
        <div className="px-2 pb-3 space-y-0.5" style={{ borderTop: '1px solid oklch(0.22 0.04 256)', paddingTop: '12px' }}>
          {/* Buka storefront pembeli di tab baru — hanya owner/manager */}
          {isPrivileged && <a href="/toko" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
            style={{ color: 'oklch(0.6 0.02 250)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'oklch(0.2 0.04 256)'; (e.currentTarget as HTMLElement).style.color = 'white' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'oklch(0.6 0.02 250)' }}>
            <Store size={18} className="shrink-0" />
            <span className={cn('flex-1 transition-all duration-300 truncate', open ? 'opacity-100' : 'opacity-0 lg:opacity-0 w-0')}>Toko Online</span>
            {open && <ExternalLink size={13} className="shrink-0 opacity-60" />}
          </a>}
          {visibleBottom.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
                style={{ color: active ? 'white' : 'oklch(0.6 0.02 250)', background: active ? 'oklch(0.55 0.22 264)' : undefined }}>
                <Icon size={18} className="shrink-0" />
                <span className={cn('transition-all duration-300 truncate', open ? 'opacity-100' : 'opacity-0 lg:opacity-0 w-0')}>{item.title}</span>
              </Link>
            )
          })}

          {/* User + logout */}
          <div className={cn('px-3 py-2 transition-all duration-300', open ? 'opacity-100' : 'opacity-0 lg:opacity-0 h-0 overflow-hidden p-0')}>
            <div className="flex items-center gap-2 py-2">
              <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white', getAvatarColor(userName))}>
                {getInitials(userName)}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-semibold truncate" style={{ color: 'oklch(0.88 0.01 250)' }}>{userName}</p>
                <p className="text-xs truncate" style={{ color: 'oklch(0.5 0.02 250)' }}>{userRole}</p>
              </div>
              <button onClick={handleLogout} className="shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors"
                style={{ color: 'oklch(0.5 0.02 250)' }} title="Logout">
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useCurrentUserStore } from '@/stores/use-current-user-store'
import { useActiveOutletStore } from '@/stores/use-active-outlet-store'

/** Halaman dashboard yang boleh diakses karyawan (cashier). */
const CASHIER_ALLOWED = [
  '/dashboard/karyawan/absensi', // Absensi + Analisis Absensi (sub-path)
  '/dashboard/inventori',        // Stok (mode lihat-saja)
]

/** Halaman yang boleh diakses manager (TANPA Akuntansi/Promosi/Pelanggan/Karyawan-mgmt/Outlet/Pengaturan). */
const MANAGER_ALLOWED = [
  '/dashboard/produk',
  '/dashboard/inventori',
  '/dashboard/pembelian',
  '/dashboard/stok-keluar',
  '/dashboard/penjualan',
  '/dashboard/laporan',
  '/dashboard/karyawan/absensi',
]

/**
 * Pembatas akses + isolasi cabang. Owner = bebas. Manager = akses luas (tanpa modul terlarang),
 * bisa lintas cabang. Karyawan (cashier) = hanya Absensi/Analisis/Stok(lihat), dikunci ke cabangnya.
 */
export function RoleGuard() {
  const router = useRouter()
  const pathname = usePathname()
  const user = useCurrentUserStore((s) => s.user)
  const loaded = useCurrentUserStore((s) => s.loaded)
  const setActiveOutlet = useActiveOutletStore((s) => s.setActiveOutlet)

  useEffect(() => {
    if (!loaded || !user) return
    const role = (user.role || '').toLowerCase()
    if (role === 'owner') return
    if (role === 'manager') {
      if (pathname === '/dashboard') return
      const ok = MANAGER_ALLOWED.some((p) => pathname === p || pathname.startsWith(p + '/'))
      if (!ok) router.replace('/dashboard')
      return
    }
    // Karyawan: kunci outlet aktif ke cabangnya + batasi halaman.
    if (user.outletId) setActiveOutlet(user.outletId)
    const ok = CASHIER_ALLOWED.some((p) => pathname === p || pathname.startsWith(p + '/'))
    if (!ok) router.replace('/dashboard/karyawan/absensi')
  }, [loaded, user, pathname, router, setActiveOutlet])

  return null
}

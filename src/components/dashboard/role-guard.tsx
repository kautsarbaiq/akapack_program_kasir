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

/**
 * Pembatas akses + isolasi cabang. Owner/manager bebas (semua cabang).
 * Karyawan (cashier): hanya Absensi, Analisis Absensi, Stok (lihat) — selain itu dilempar
 * ke Absensi; dan outlet aktif DIKUNCI ke cabang karyawan tsb (tak bisa lihat cabang lain).
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
    if (role === 'owner' || role === 'manager') return
    // Karyawan: kunci outlet aktif ke cabangnya.
    if (user.outletId) setActiveOutlet(user.outletId)
    // Batasi halaman.
    const ok = CASHIER_ALLOWED.some((p) => pathname === p || pathname.startsWith(p + '/'))
    if (!ok) router.replace('/dashboard/karyawan/absensi')
  }, [loaded, user, pathname, router, setActiveOutlet])

  return null
}

'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useCurrentUserStore } from '@/stores/use-current-user-store'

/** Halaman dashboard yang boleh diakses karyawan (cashier). Selain ini → dilempar ke sini. */
const CASHIER_HOME = '/dashboard/karyawan/absensi'

/**
 * Pembatas akses berdasar peran. Owner & manager bebas; karyawan (cashier/lainnya)
 * hanya boleh halaman Absensi di dalam area dashboard (POS ada di /pos, di luar layout ini).
 * Menunggu sesi termuat dulu agar tak salah-redirect saat role belum diketahui.
 */
export function RoleGuard() {
  const router = useRouter()
  const pathname = usePathname()
  const user = useCurrentUserStore((s) => s.user)
  const loaded = useCurrentUserStore((s) => s.loaded)

  useEffect(() => {
    if (!loaded || !user) return
    const role = (user.role || '').toLowerCase()
    if (role === 'owner' || role === 'manager') return
    if (pathname === CASHIER_HOME || pathname.startsWith(CASHIER_HOME + '/')) return
    router.replace(CASHIER_HOME)
  }, [loaded, user, pathname, router])

  return null
}

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrentUserStore } from '@/stores/use-current-user-store'

/** POS punya layout sendiri (tanpa RoleGuard dashboard). Sales TIDAK boleh pakai kasir —
 *  arahkan ke Surat Pesanan. Pertahanan klien di atas proteksi server (proxy.ts). */
export function PosRoleGuard() {
  const router = useRouter()
  const user = useCurrentUserStore((s) => s.user)
  const loaded = useCurrentUserStore((s) => s.loaded)

  useEffect(() => {
    if (!loaded || !user) return
    if ((user.role || '').toLowerCase() === 'sales') router.replace('/dashboard/surat-pesanan')
  }, [loaded, user, router])

  return null
}

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { hasStaffSession } from '@/stores/use-current-user-store'

/**
 * Proteksi route sisi-klien. Diperlukan di build Tauri / static export yang TIDAK
 * menjalankan `proxy.ts` (middleware). Di web, ini lapis kedua setelah proxy.
 * Jika Supabase belum dikonfigurasi (mode mock), tidak mengunci apa pun.
 *
 * Tidak memakai state — anak dirender langsung, dan pengguna tanpa sesi dialihkan
 * ke /login sebagai efek samping (di web proxy sudah mencegah akses lebih dulu).
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    if (!isSupabaseConfigured()) return
    let active = true
    const check = async () => {
      if (hasStaffSession()) return // karyawan login via nama+PIN — sesi valid
      const { data } = await getSupabaseBrowser().auth.getSession()
      if (active && !data.session) router.replace('/login')
    }
    void check()
    return () => { active = false }
  }, [router])

  return <>{children}</>
}

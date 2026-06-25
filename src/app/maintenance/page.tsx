'use client'

import { useState, useEffect } from 'react'
import { Wrench } from 'lucide-react'
import { getSupabaseBrowser } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'

// Halaman "Sedang Maintenance". Ditampilkan middleware (proxy.ts) saat mode maintenance aktif.
// Pesan diambil dari app_config (di-set lewat Pengaturan), fallback ke pesan default.
const DEFAULT_MSG =
  'Website sedang dalam perbaikan & peningkatan. Mohon kembali beberapa saat lagi — terima kasih atas pengertiannya.'

export default function MaintenancePage() {
  const [message, setMessage] = useState(DEFAULT_MSG)

  useEffect(() => {
    if (!isSupabaseConfigured()) return
    void (async () => {
      try {
        const { data } = await getSupabaseBrowser()
          .from('app_config').select('maintenance_message').eq('id', 1).single()
        if (data?.maintenance_message && data.maintenance_message.trim()) setMessage(data.maintenance_message.trim())
      } catch { /* pakai default */ }
    })()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-gradient-to-b from-background to-muted/40">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl shadow-lg"
          style={{ background: 'oklch(0.55 0.22 264)' }}>
          <Wrench size={38} className="text-white" />
        </div>

        <p className="text-sm font-semibold tracking-wide" style={{ color: 'oklch(0.55 0.22 264)' }}>AKAPACK</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">Sedang Maintenance</h1>
        <p className="mt-4 text-muted-foreground leading-relaxed">{message}</p>

        <div className="mt-8 inline-flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-xs text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
          </span>
          Sistem akan segera kembali normal
        </div>
      </div>
    </div>
  )
}

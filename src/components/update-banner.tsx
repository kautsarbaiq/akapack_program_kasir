'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

const MINE = process.env.NEXT_PUBLIC_BUILD_ID

/**
 * Spanduk "versi baru tersedia". Tab kasir sering terbuka berhari-hari dan terus menjalankan kode
 * lama sampai dimuat ulang — perbaikan stok/riwayat baru berlaku setelah reload. TIDAK memuat ulang
 * otomatis: keranjang kasir hanya ada di memori, reload di tengah transaksi akan menghapusnya.
 * Antrean stok & struk ada di penyimpanan perangkat, jadi aman dimuat ulang kapan pun.
 */
export function UpdateBanner() {
  const [stale, setStale] = useState(false)

  useEffect(() => {
    if (!MINE) return
    let alive = true
    const check = async () => {
      try {
        const r = await fetch(`/api/version?t=${Date.now()}`, { cache: 'no-store' })
        if (!r.ok) return
        const j = (await r.json()) as { build?: string }
        if (alive && j.build && j.build !== MINE) setStale(true)
      } catch { /* offline / halaman maintenance → abaikan */ }
    }
    void check()
    const timer = window.setInterval(check, 5 * 60_000)
    const onVisible = () => { if (document.visibilityState === 'visible') void check() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { alive = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  if (!stale) return null
  return (
    <div className="fixed top-0 inset-x-0 z-[100] flex items-center justify-center gap-3 bg-amber-500 text-black px-4 py-2 text-sm font-medium shadow-md print:hidden">
      <span>Versi baru aplikasi tersedia — selesaikan transaksi yang sedang berjalan, lalu muat ulang.</span>
      <button type="button" onClick={() => window.location.reload()}
        className="inline-flex items-center gap-1.5 rounded-md bg-black/85 text-white px-3 py-1 text-xs font-semibold hover:bg-black">
        <RefreshCw size={13} /> Muat ulang
      </button>
    </div>
  )
}

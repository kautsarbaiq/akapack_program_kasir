'use client'

import { useState } from 'react'

/**
 * Host storage yang SEDANG TIDAK TERSEDIA (proyek Supabase lama kena batas kuota → semua file 402).
 * URL-nya TETAP disimpan di database (tak ada data hilang) — kita cuma tidak meminta filenya, supaya:
 *   1) POS tak melambat karena ribuan permintaan gambar yang pasti gagal,
 *   2) proyek lama tak terus-menerus ditembak (kuotanya bisa reda/reset).
 * SETELAH foto dipulihkan (lihat tools/recover-product-images.mjs), KOSONGKAN daftar ini.
 */
const UNAVAILABLE_IMAGE_HOSTS = ['rftzuodlvuhpmkndbjcz.supabase.co']

/** true bila URL menunjuk storage yang sedang tak bisa diakses → jangan buang waktu memuatnya. */
export function isImageHostUnavailable(src?: string | null): boolean {
  if (!src) return false
  return UNAVAILABLE_IMAGE_HOSTS.some((h) => src.includes(h))
}

/**
 * <img> produk dengan fallback: bila file GAGAL dimuat (mis. storage proyek lama terblokir/terhapus),
 * tampilkan fallback (ikon kategori) alih-alih ikon "gambar rusak" bawaan browser.
 */
export function ProductImg({ src, alt, className, fallback }: {
  src: string
  alt: string
  className?: string
  fallback: React.ReactNode
}) {
  const [broken, setBroken] = useState(false)
  // Host mati → langsung fallback TANPA request jaringan (hemat waktu & bandwidth).
  if (broken || isImageHostUnavailable(src)) return <>{fallback}</>
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} loading="lazy" onError={() => setBroken(true)} />
}

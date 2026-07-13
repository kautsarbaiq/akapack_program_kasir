'use client'

import { useState } from 'react'

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
  if (broken) return <>{fallback}</>
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} loading="lazy" onError={() => setBroken(true)} />
}

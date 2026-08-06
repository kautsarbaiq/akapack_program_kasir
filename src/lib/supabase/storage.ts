'use client'

import { getSupabaseBrowser } from './client'
import { isSupabaseConfigured } from './config'

const BUCKET = 'product-images'
const MAX_SIDE = 900      // sisi terpanjang (px) — cukup tajam untuk kartu produk & halaman detail
const QUALITY = 0.82      // kualitas JPEG hasil kompresi

/**
 * Perkecil + kompres foto di BROWSER sebelum diunggah.
 * Foto kamera HP bisa 3–5 MB; setelah ini biasanya jadi ~40–80 KB (10–50× lebih kecil).
 * Ini penting: penyimpanan & kuota bandwidth gratisan jadi awet, dan web terasa jauh lebih cepat.
 * Kalau proses gagal (format aneh), file asli tetap dipakai — upload tak pernah batal karenanya.
 */
async function compressImage(file: File): Promise<Blob> {
  try {
    if (!file.type.startsWith('image/')) return file
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', QUALITY))
    // Pakai hasil kompresi hanya bila memang lebih kecil dari aslinya.
    return blob && blob.size > 0 && blob.size < file.size ? blob : file
  } catch {
    return file
  }
}

/** Upload foto produk ke Supabase Storage (otomatis dikecilkan). Mengembalikan public URL atau null. */
export async function uploadProductImage(file: File): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  try {
    const sb = getSupabaseBrowser()
    const body = await compressImage(file)
    const ext = body.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() || 'jpg').toLowerCase()
    const rand = Math.random().toString(36).slice(2, 8)
    const path = `${Date.now()}-${rand}.${ext}`
    const { error } = await sb.storage.from(BUCKET).upload(path, body, { upsert: true, contentType: body.type || file.type })
    if (error) {
      console.warn('[akapack] gagal upload foto:', error.message)
      return null
    }
    const { data } = sb.storage.from(BUCKET).getPublicUrl(path)
    return data.publicUrl
  } catch (e) {
    console.warn('[akapack] error upload foto:', e)
    return null
  }
}

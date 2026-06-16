'use client'

import { getSupabaseBrowser } from './client'
import { isSupabaseConfigured } from './config'

const BUCKET = 'product-images'

/** Upload foto produk ke Supabase Storage. Mengembalikan public URL atau null. */
export async function uploadProductImage(file: File): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  try {
    const sb = getSupabaseBrowser()
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const rand = Math.random().toString(36).slice(2, 8)
    const path = `${Date.now()}-${rand}.${ext}`
    const { error } = await sb.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type })
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

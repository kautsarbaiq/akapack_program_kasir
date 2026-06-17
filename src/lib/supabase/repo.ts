'use client'

// Lapisan akses data generik. Mengembalikan null jika Supabase belum siap,
// sehingga store bisa fallback ke data lokal/mock tanpa error.

import { getSupabaseBrowser } from './client'
import { isSupabaseConfigured } from './config'

export async function fetchAll<T>(
  table: string,
  orderBy = 'created_at',
  ascending = false
): Promise<T[] | null> {
  if (!isSupabaseConfigured()) return null
  try {
    const sb = getSupabaseBrowser()
    const PAGE = 1000 // Supabase/PostgREST membatasi 1000 baris/permintaan — paginasi agar SEMUA terbaca
    const out: T[] = []
    let from = 0
    for (;;) {
      const { data, error } = await sb
        .from(table)
        .select('*')
        .order(orderBy, { ascending })
        .range(from, from + PAGE - 1)
      if (error) {
        console.warn(`[akapack] gagal load ${table}:`, error.message)
        return from === 0 ? null : out // halaman pertama gagal → null; sebagian sudah termuat → kembalikan itu
      }
      const rows = (data ?? []) as T[]
      out.push(...rows)
      if (rows.length < PAGE) break
      from += PAGE
    }
    return out
  } catch (e) {
    console.warn(`[akapack] error load ${table}:`, e)
    return null
  }
}

export async function insertRow<T>(table: string, row: Record<string, unknown>): Promise<T | null> {
  if (!isSupabaseConfigured()) return null
  try {
    const { data, error } = await getSupabaseBrowser().from(table).insert(row).select().single()
    if (error) {
      console.warn(`[akapack] gagal insert ${table}:`, error.message)
      return null
    }
    return data as T
  } catch (e) {
    console.warn(`[akapack] error insert ${table}:`, e)
    return null
  }
}

export async function updateRow<T>(
  table: string,
  id: string,
  patch: Record<string, unknown>
): Promise<T | null> {
  if (!isSupabaseConfigured()) return null
  try {
    const { data, error } = await getSupabaseBrowser().from(table).update(patch).eq('id', id).select().single()
    if (error) {
      console.warn(`[akapack] gagal update ${table}:`, error.message)
      return null
    }
    return data as T
  } catch (e) {
    console.warn(`[akapack] error update ${table}:`, e)
    return null
  }
}

export async function deleteRow(table: string, id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  try {
    const { error } = await getSupabaseBrowser().from(table).delete().eq('id', id)
    if (error) {
      console.warn(`[akapack] gagal delete ${table}:`, error.message)
      return false
    }
    return true
  } catch (e) {
    console.warn(`[akapack] error delete ${table}:`, e)
    return false
  }
}

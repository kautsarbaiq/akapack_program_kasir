// Konfigurasi & deteksi kesiapan Supabase (tanpa impor SDK — aman di server & client).

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

// Tenant default untuk mode internal (1 bisnis). Cocok dgn migration 0002.
export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

// Outlet default — dipakai menyimpan pengaturan toko (pajak, service charge, struk).
export const DEFAULT_OUTLET_ID = '00000000-0000-0000-0000-000000000002'

/**
 * True hanya jika env Supabase terisi & masuk akal.
 * Catatan: anon key Supabase yang valid panjang (>40 char). Key 36-char yang
 * terpotong akan ditolak di sini -> app otomatis fallback ke data mock.
 */
export function isSupabaseConfigured(): boolean {
  return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(SUPABASE_URL.trim()) && SUPABASE_ANON_KEY.trim().length >= 40
}

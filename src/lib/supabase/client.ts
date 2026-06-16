'use client'

import { createBrowserClient } from '@supabase/ssr'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config'

let browserClient: ReturnType<typeof createBrowserClient> | null = null

/** Singleton Supabase client untuk komponen/browser. Panggil hanya bila isSupabaseConfigured(). */
export function getSupabaseBrowser() {
  if (!browserClient) {
    browserClient = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  }
  return browserClient
}

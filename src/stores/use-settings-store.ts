import { create } from 'zustand'
import { getSupabaseBrowser } from '@/lib/supabase/client'
import { isSupabaseConfigured, DEFAULT_TENANT_ID, DEFAULT_OUTLET_ID } from '@/lib/supabase/config'

interface OutletRow {
  id: string
  name: string | null
  tax_rate: number | null
  service_charge: number | null
  receipt_footer: string | null
}

interface SettingsValues {
  taxRate: number
  serviceRate: number
  storeName: string
  receiptFooter: string
}

interface SettingsStore extends SettingsValues {
  loaded: boolean
  fetch: () => Promise<void>
  save: (patch: Partial<SettingsValues>) => Promise<void>
}

const DEFAULTS: SettingsValues = {
  taxRate: 0,
  serviceRate: 0,
  storeName: 'AKAPACK',
  receiptFooter: 'Terima kasih telah berbelanja 🙏',
}

export const useSettingsStore = create<SettingsStore>()((set, get) => ({
  ...DEFAULTS,
  loaded: false,

  fetch: async () => {
    if (!isSupabaseConfigured()) {
      set({ loaded: true })
      return
    }
    try {
      const { data, error } = await getSupabaseBrowser()
        .from('outlets')
        .select('id, name, tax_rate, service_charge, receipt_footer')
        .eq('id', DEFAULT_OUTLET_ID)
        .maybeSingle()
      if (error) {
        set({ loaded: true })
        return
      }
      const row = data as OutletRow | null
      if (row) {
        set({
          taxRate: row.tax_rate ?? 0,
          serviceRate: row.service_charge ?? 0,
          storeName: row.name ?? DEFAULTS.storeName,
          receiptFooter: row.receipt_footer ?? DEFAULTS.receiptFooter,
          loaded: true,
        })
      } else {
        set({ loaded: true })
      }
    } catch {
      set({ loaded: true })
    }
  },

  save: async (patch) => {
    set(patch)
    if (!isSupabaseConfigured()) return
    const s = get()
    try {
      await getSupabaseBrowser()
        .from('outlets')
        .upsert(
          {
            id: DEFAULT_OUTLET_ID,
            tenant_id: DEFAULT_TENANT_ID,
            name: s.storeName,
            tax_rate: s.taxRate,
            service_charge: s.serviceRate,
            receipt_footer: s.receiptFooter,
          },
          { onConflict: 'id' }
        )
    } catch (e) {
      console.warn('[akapack] gagal simpan pengaturan:', e)
    }
  },
}))

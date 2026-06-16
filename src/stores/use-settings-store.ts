import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
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

// Pengaturan khusus Toko Online — disimpan di localStorage (belum ada kolomnya di outlets).
interface OnlineSettings {
  storePhone: string
  storeAddress: string
  waNumber: string   // nomor WhatsApp toko untuk menerima konfirmasi pesanan
  bankInfo: string   // info rekening / cara bayar (multiline)
  shippingFlat: number
}

interface SettingsStore extends SettingsValues, OnlineSettings {
  loaded: boolean
  fetch: () => Promise<void>
  save: (patch: Partial<SettingsValues>) => Promise<void>
  saveOnline: (patch: Partial<OnlineSettings>) => void
}

const DEFAULTS: SettingsValues = {
  taxRate: 0,
  serviceRate: 0,
  storeName: 'AKAPACK',
  receiptFooter: 'Terima kasih telah berbelanja 🙏',
}

const ONLINE_DEFAULTS: OnlineSettings = {
  storePhone: '',
  storeAddress: '',
  waNumber: '',
  bankInfo: '',
  shippingFlat: 10000,
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
  ...DEFAULTS,
  ...ONLINE_DEFAULTS,
  loaded: false,

  saveOnline: (patch) => set(patch),

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
    }),
    {
      name: 'akapack-online-settings',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      // Hanya field Toko Online yang dipersist; field outlet (pajak/nama/footer) tetap dari Supabase.
      partialize: (s): OnlineSettings => ({
        storePhone: s.storePhone,
        storeAddress: s.storeAddress,
        waNumber: s.waNumber,
        bankInfo: s.bankInfo,
        shippingFlat: s.shippingFlat,
      }),
    }
  )
)

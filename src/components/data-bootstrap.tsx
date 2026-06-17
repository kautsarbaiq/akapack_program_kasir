'use client'

import { useEffect } from 'react'
import { useCategoryStore } from '@/stores/use-category-store'
import { useProductStore } from '@/stores/use-product-store'
import { useCustomerStore } from '@/stores/use-customer-store'
import { useEmployeeStore } from '@/stores/use-employee-store'
import { usePromotionStore } from '@/stores/use-promotion-store'
import { useTransactionStore } from '@/stores/use-transaction-store'
import { useShiftStore } from '@/stores/use-shift-store'
import { useSettingsStore } from '@/stores/use-settings-store'
import { useStockMovementStore } from '@/stores/use-stock-movement-store'
import { useVariantStore } from '@/stores/use-variant-store'
import { useStoreCart } from '@/stores/use-store-cart'
import { useAccountStore } from '@/stores/use-account-store'
import { useJournalStore } from '@/stores/use-journal-store'
import { useAssetStore } from '@/stores/use-asset-store'
import { useClosingStore } from '@/stores/use-closing-store'
import { useSupplierStore } from '@/stores/use-supplier-store'
import { usePurchaseStore } from '@/stores/use-purchase-store'
import { useStockOutStore } from '@/stores/use-stockout-store'
import { useOutletStore } from '@/stores/use-outlet-store'
import { useInventoryStore } from '@/stores/use-inventory-store'
import { useActiveOutletStore } from '@/stores/use-active-outlet-store'
import { useAttendanceStore } from '@/stores/use-attendance-store'
import { useCurrentUserStore } from '@/stores/use-current-user-store'

/**
 * Memuat data dari Supabase sekali saat aplikasi (area login) mount.
 * Jika Supabase belum dikonfigurasi, store tetap memakai data mock (fetch no-op).
 * Tidak merender apa pun.
 */
export function DataBootstrap() {
  useEffect(() => {
    // Rehydrate store ber-persist SETELAH mount (skipHydration) — cegah hydration mismatch
    // antara HTML prerender statis (kosong) dan localStorage.
    void useStoreCart.persist.rehydrate()
    void useSettingsStore.persist.rehydrate()
    void useAssetStore.persist.rehydrate()
    void useClosingStore.persist.rehydrate()
    void useActiveOutletStore.persist.rehydrate()

    const run = async () => {
      // kategori dulu — produk butuh kategori untuk resolusi nama
      await useCategoryStore.getState().fetch()
      await Promise.all([
        useProductStore.getState().fetch(),
        useCustomerStore.getState().fetch(),
        useEmployeeStore.getState().fetch(),
        usePromotionStore.getState().fetch(),
        useSettingsStore.getState().fetch(),
        useVariantStore.getState().fetch(),
        useAccountStore.getState().fetch(),
        useSupplierStore.getState().fetch(),
        useOutletStore.getState().fetch(),
        useInventoryStore.getState().fetch(),
      ])
      // User login (nama/role di-resolve dari karyawan via email) — setelah employee fetch
      void useCurrentUserStore.getState().fetch()
      // Proyeksikan stok produk/varian ke outlet aktif (setelah produk, varian, inventory termuat)
      const outlet = useActiveOutletStore.getState().activeOutletId
      useProductStore.getState().projectStock(outlet)
      useVariantStore.getState().projectVariantStock(outlet)
      // transaksi, shift, pergerakan stok, jurnal, pembelian — butuh master data untuk resolusi
      await Promise.all([
        useTransactionStore.getState().fetch(),
        useShiftStore.getState().fetch(),
        useStockMovementStore.getState().fetch(),
        useJournalStore.getState().fetch(),
        usePurchaseStore.getState().fetch(),
        useStockOutStore.getState().fetch(),
        useAttendanceStore.getState().fetch(),
      ])
    }
    void run()
  }, [])

  return null
}

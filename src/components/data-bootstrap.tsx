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

/**
 * Memuat data dari Supabase sekali saat aplikasi (area login) mount.
 * Jika Supabase belum dikonfigurasi, store tetap memakai data mock (fetch no-op).
 * Tidak merender apa pun.
 */
export function DataBootstrap() {
  useEffect(() => {
    const run = async () => {
      // kategori dulu — produk butuh kategori untuk resolusi nama
      await useCategoryStore.getState().fetch()
      await Promise.all([
        useProductStore.getState().fetch(),
        useCustomerStore.getState().fetch(),
        useEmployeeStore.getState().fetch(),
        usePromotionStore.getState().fetch(),
        useSettingsStore.getState().fetch(),
      ])
      // transaksi, shift, pergerakan stok — butuh master data untuk resolusi
      await Promise.all([
        useTransactionStore.getState().fetch(),
        useShiftStore.getState().fetch(),
        useStockMovementStore.getState().fetch(),
      ])
    }
    void run()
  }, [])

  return null
}

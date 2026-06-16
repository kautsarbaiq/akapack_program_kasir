'use client'

import { useMemo } from 'react'
import { useAccountStore } from '@/stores/use-account-store'
import { useTransactionStore } from '@/stores/use-transaction-store'
import { useJournalStore } from '@/stores/use-journal-store'
import { useProductStore } from '@/stores/use-product-store'
import { buildJournalEntries, computeLedger, computeProfitLoss, computeBalanceSheet } from './accounting'

/**
 * Sumber tunggal data akuntansi: gabung saldo awal + jurnal turunan transaksi + jurnal manual,
 * lalu hitung buku besar, laba-rugi, dan neraca (kumulatif / sepanjang waktu).
 */
export function useBooks() {
  const accounts = useAccountStore((s) => s.accounts)
  const transactions = useTransactionStore((s) => s.transactions)
  const manualEntries = useJournalStore((s) => s.manualEntries)
  const products = useProductStore((s) => s.products)

  return useMemo(() => {
    const completed = transactions.filter((t) => t.status === 'completed')
    const costByProductId = new Map(products.map((p) => [p.id, p.cost_price]))
    const entries = buildJournalEntries({ accounts, transactions: completed, manualEntries, costByProductId })
    const ledger = computeLedger(accounts, entries)
    const profitLoss = computeProfitLoss(ledger)
    const balanceSheet = computeBalanceSheet(ledger, profitLoss.netProfit)
    return { accounts, completed, manualEntries, costByProductId, entries, ledger, profitLoss, balanceSheet }
  }, [accounts, transactions, manualEntries, products])
}

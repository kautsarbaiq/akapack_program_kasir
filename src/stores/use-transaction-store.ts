import { create } from 'zustand'
import type { Transaction } from '@/types'
import { mockTransactions } from '@/lib/mock-data'

interface TransactionStore {
  transactions: Transaction[]
  /** Transaksi terakhir yang sukses — dipakai untuk preview struk */
  lastTransaction: Transaction | null
  addTransaction: (txn: Transaction) => void
  voidTransaction: (id: string) => void
}

export const useTransactionStore = create<TransactionStore>()((set) => ({
  transactions: mockTransactions,
  lastTransaction: null,

  addTransaction: (txn) =>
    set((state) => ({
      transactions: [txn, ...state.transactions],
      lastTransaction: txn,
    })),

  voidTransaction: (id) =>
    set((state) => ({
      transactions: state.transactions.map((t) =>
        t.id === id ? { ...t, status: 'void' } : t
      ),
    })),
}))

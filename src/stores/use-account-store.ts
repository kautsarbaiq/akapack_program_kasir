import { create } from 'zustand'
import type { Account, AccountType } from '@/types'
import { mockAccounts } from '@/lib/mock-data'
import { generateId } from '@/lib/utils'
import { DEFAULT_TENANT_ID } from '@/lib/supabase/config'
import { fetchAll, insertRow, updateRow, deleteRow } from '@/lib/supabase/repo'

interface AccountRow {
  id: string
  code: string
  name: string
  type: AccountType
  opening_balance: number | null
  is_active: boolean | null
  description: string | null
  created_at: string
}

export interface AccountInput {
  code: string
  name: string
  type: AccountType
  opening_balance: number
  description?: string
  is_active?: boolean
}

interface AccountStore {
  accounts: Account[]
  loaded: boolean
  fetch: () => Promise<void>
  addAccount: (data: AccountInput) => Account
  updateAccount: (id: string, data: AccountInput) => void
  deleteAccount: (id: string) => void
}

export const useAccountStore = create<AccountStore>()((set) => ({
  accounts: mockAccounts,
  loaded: false,

  fetch: async () => {
    const rows = await fetchAll<AccountRow>('accounts', 'code', true)
    // null = Supabase off / tabel belum ada; kosong = migration belum di-seed → pertahankan COA mock.
    if (!rows || rows.length === 0) {
      set({ loaded: true })
      return
    }
    const mapped: Account[] = rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      type: r.type,
      opening_balance: r.opening_balance ?? 0,
      is_active: r.is_active ?? true,
      description: r.description ?? undefined,
      created_at: r.created_at,
    }))
    set({ accounts: mapped, loaded: true })
  },

  addAccount: (data) => {
    const acc: Account = {
      id: generateId('acc'),
      code: data.code,
      name: data.name,
      type: data.type,
      opening_balance: data.opening_balance,
      description: data.description,
      is_active: data.is_active ?? true,
      created_at: new Date().toISOString(),
    }
    set((s) => ({ accounts: [...s.accounts, acc].sort((a, b) => a.code.localeCompare(b.code)) }))
    void insertRow<AccountRow>('accounts', {
      tenant_id: DEFAULT_TENANT_ID,
      code: acc.code,
      name: acc.name,
      type: acc.type,
      opening_balance: acc.opening_balance,
      description: acc.description ?? null,
      is_active: acc.is_active,
    }).then((row) => {
      if (row) set((s) => ({ accounts: s.accounts.map((a) => (a.id === acc.id ? { ...a, id: row.id } : a)) }))
    })
    return acc
  },

  updateAccount: (id, data) => {
    set((s) => ({
      accounts: s.accounts
        .map((a) => (a.id === id ? { ...a, ...data, is_active: data.is_active ?? a.is_active } : a))
        .sort((a, b) => a.code.localeCompare(b.code)),
    }))
    void updateRow('accounts', id, {
      code: data.code,
      name: data.name,
      type: data.type,
      opening_balance: data.opening_balance,
      description: data.description ?? null,
      is_active: data.is_active ?? true,
    })
  },

  deleteAccount: (id) => {
    set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) }))
    void deleteRow('accounts', id)
  },
}))

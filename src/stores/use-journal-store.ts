import { create } from 'zustand'
import type { JournalEntry, JournalLine, JournalSource } from '@/types'
import { getSupabaseBrowser } from '@/lib/supabase/client'
import { isSupabaseConfigured, DEFAULT_TENANT_ID } from '@/lib/supabase/config'
import { deleteRow } from '@/lib/supabase/repo'
import { useAccountStore } from './use-account-store'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (s?: string | null): s is string => !!s && UUID_RE.test(s)

interface JournalLineRow {
  id: string
  entry_id: string
  account_id: string | null
  debit: number
  credit: number
}

interface JournalEntryRow {
  id: string
  number: string
  date: string
  description: string | null
  source: string | null
  reference_id: string | null
  created_at: string
  journal_lines: JournalLineRow[] | null
}

/** Simpan header jurnal + baris-barisnya. Mengembalikan id DB, atau null. */
async function persistEntry(entry: JournalEntry): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  try {
    const sb = getSupabaseBrowser()
    const { data, error } = await sb
      .from('journal_entries')
      .insert({
        tenant_id: DEFAULT_TENANT_ID,
        number: entry.number,
        date: entry.date,
        description: entry.description,
        source: entry.source,
        reference_id: isUuid(entry.reference_id) ? entry.reference_id : null,
      })
      .select('id')
      .single()
    if (error || !data) {
      console.warn('[akapack] gagal simpan jurnal:', error?.message)
      return null
    }
    const entryId = (data as { id: string }).id
    const rows = entry.lines.map((l) => ({
      entry_id: entryId,
      account_id: isUuid(l.account_id) ? l.account_id : null,
      debit: l.debit,
      credit: l.credit,
    }))
    const { error: lineErr } = await sb.from('journal_lines').insert(rows)
    if (lineErr) console.warn('[akapack] gagal simpan baris jurnal:', lineErr.message)
    return entryId
  } catch (e) {
    console.warn('[akapack] error simpan jurnal:', e)
    return null
  }
}

interface JournalStore {
  /** Hanya jurnal MANUAL. Jurnal POS/Online diturunkan otomatis di lib/accounting. */
  manualEntries: JournalEntry[]
  loaded: boolean
  fetch: () => Promise<void>
  addEntry: (entry: JournalEntry) => void
  deleteEntry: (id: string) => void
}

export const useJournalStore = create<JournalStore>()((set) => ({
  manualEntries: [],
  loaded: false,

  fetch: async () => {
    if (!isSupabaseConfigured()) {
      set({ loaded: true })
      return
    }
    try {
      const sb = getSupabaseBrowser()
      // Paginasi (hindari batas 1000 baris PostgREST).
      const data: JournalEntryRow[] = []
      for (let from = 0; ; from += 1000) {
        const { data: page, error } = await sb
          .from('journal_entries')
          .select('*, journal_lines(*)')
          .eq('source', 'manual')
          .order('date', { ascending: false })
          .range(from, from + 999)
        if (error) { if (from === 0) { set({ loaded: true }); return } break }
        const rows = (page ?? []) as unknown as JournalEntryRow[]
        data.push(...rows)
        if (rows.length < 1000) break
      }
      const accounts = useAccountStore.getState().accounts
      const mapped: JournalEntry[] = (data as unknown as JournalEntryRow[]).map((r) => {
        const lines: JournalLine[] = (r.journal_lines ?? []).map((l) => {
          const acc = accounts.find((a) => a.id === l.account_id)
          return {
            account_id: l.account_id ?? '',
            account_code: acc?.code,
            account_name: acc?.name,
            debit: l.debit,
            credit: l.credit,
          }
        })
        return {
          id: r.id,
          number: r.number,
          date: r.date,
          description: r.description ?? '',
          source: (r.source as JournalSource) ?? 'manual',
          reference_id: r.reference_id ?? undefined,
          lines,
          created_at: r.created_at,
        }
      })
      set({ manualEntries: mapped, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },

  addEntry: (entry) => {
    set((s) => ({ manualEntries: [entry, ...s.manualEntries] }))
    void persistEntry(entry).then((newId) => {
      if (!newId) return
      set((s) => ({ manualEntries: s.manualEntries.map((e) => (e.id === entry.id ? { ...e, id: newId } : e)) }))
    })
  },

  deleteEntry: (id) => {
    set((s) => ({ manualEntries: s.manualEntries.filter((e) => e.id !== id) }))
    if (isUuid(id)) void deleteRow('journal_entries', id)
  },
}))

// Logika akuntansi double-entry AKAPACK (murni, tanpa React).
// Jurnal POS/Online diturunkan OTOMATIS dari transaksi (tidak disimpan ganda);
// jurnal manual & saldo awal digabung untuk membentuk buku besar & laporan.

import type { Account, AccountType, Asset, JournalEntry, JournalLine, Transaction } from '@/types'

// Kode akun baku yang dirujuk mesin jurnal otomatis (lihat mockAccounts / migration 0009).
export const ACC = {
  CASH: '1-100',
  BANK: '1-110',
  AR: '1-120',
  INVENTORY: '1-130',
  VAT_PAYABLE: '2-200',
  SALES: '4-100',
  SHIPPING_REV: '4-110',
  OTHER_REV: '4-200',
  COGS: '5-100',
  SALES_DISCOUNT: '5-200',
} as const

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  asset: 'Aset',
  liability: 'Kewajiban',
  equity: 'Ekuitas',
  revenue: 'Pendapatan',
  expense: 'Beban',
}

export const ACCOUNT_TYPE_ORDER: AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense']

export function normalBalance(type: AccountType): 'debit' | 'credit' {
  return type === 'asset' || type === 'expense' ? 'debit' : 'credit'
}

const r = (n: number) => Math.round(n)

/** Ubah satu transaksi POS/Online (status completed) jadi jurnal. Null jika belum completed. */
export function transactionToJournalEntry(
  txn: Transaction,
  accountByCode: Map<string, Account>,
  costByProductId: Map<string, number>
): JournalEntry | null {
  if (txn.status !== 'completed') return null

  const lines: JournalLine[] = []
  const push = (code: string, debit: number, credit: number) => {
    if (debit === 0 && credit === 0) return
    const a = accountByCode.get(code)
    lines.push({ account_id: a?.id ?? code, account_code: code, account_name: a?.name ?? code, debit, credit })
  }

  const payCode = txn.payment_method === 'cash' ? ACC.CASH : ACC.BANK
  push(payCode, r(txn.total), 0)
  if (txn.discount_amount > 0) push(ACC.SALES_DISCOUNT, r(txn.discount_amount), 0)
  push(ACC.SALES, 0, r(txn.subtotal))
  if (txn.tax_amount > 0) push(ACC.VAT_PAYABLE, 0, r(txn.tax_amount))
  if (txn.service_charge_amount > 0) push(ACC.OTHER_REV, 0, r(txn.service_charge_amount))
  if ((txn.shipping_cost ?? 0) > 0) push(ACC.SHIPPING_REV, 0, r(txn.shipping_cost ?? 0))

  let cogs = 0
  txn.items.forEach((it) => { cogs += it.quantity * (costByProductId.get(it.product_id) ?? 0) })
  if (cogs > 0) {
    push(ACC.COGS, r(cogs), 0)
    push(ACC.INVENTORY, 0, r(cogs))
  }

  return {
    id: `auto-${txn.id}`,
    number: `JV-${txn.transaction_number}`,
    date: txn.created_at,
    description: `${txn.source === 'online' ? 'Pesanan Online' : 'Penjualan POS'} ${txn.transaction_number}`,
    source: txn.source === 'online' ? 'online' : 'pos',
    reference_id: txn.id,
    lines,
    created_at: txn.created_at,
  }
}

/** Jurnal saldo awal dari opening_balance tiap akun. Null jika semua nol. */
export function openingBalanceEntry(accounts: Account[]): JournalEntry | null {
  const lines: JournalLine[] = []
  for (const a of accounts) {
    if (!a.opening_balance) continue
    const nb = normalBalance(a.type)
    lines.push({
      account_id: a.id,
      account_code: a.code,
      account_name: a.name,
      debit: nb === 'debit' ? a.opening_balance : 0,
      credit: nb === 'credit' ? a.opening_balance : 0,
    })
  }
  if (!lines.length) return null
  const date = accounts.reduce((min, a) => (a.created_at < min ? a.created_at : min), accounts[0]?.created_at ?? '2026-01-01')
  return { id: 'opening', number: 'SALDO-AWAL', date, description: 'Saldo Awal', source: 'opening', lines, created_at: date }
}

/** Gabung semua jurnal: saldo awal + turunan transaksi + manual. Diurut tanggal naik. */
export function buildJournalEntries(opts: {
  accounts: Account[]
  transactions: Transaction[]
  manualEntries: JournalEntry[]
  costByProductId: Map<string, number>
}): JournalEntry[] {
  const byCode = new Map(opts.accounts.map((a) => [a.code, a]))
  const out: JournalEntry[] = []
  const opening = openingBalanceEntry(opts.accounts)
  if (opening) out.push(opening)
  for (const t of opts.transactions) {
    const j = transactionToJournalEntry(t, byCode, opts.costByProductId)
    if (j) out.push(j)
  }
  out.push(...opts.manualEntries)
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

export interface LedgerRow {
  account: Account
  debit: number
  credit: number
  balance: number // bertanda sesuai saldo normal akun
}

export function computeLedger(accounts: Account[], entries: JournalEntry[]): LedgerRow[] {
  const map = new Map<string, { debit: number; credit: number }>()
  for (const e of entries) {
    for (const l of e.lines) {
      const cur = map.get(l.account_id) ?? { debit: 0, credit: 0 }
      cur.debit += l.debit
      cur.credit += l.credit
      map.set(l.account_id, cur)
    }
  }
  return accounts.map((a) => {
    const t = map.get(a.id) ?? { debit: 0, credit: 0 }
    const nb = normalBalance(a.type)
    const balance = nb === 'debit' ? t.debit - t.credit : t.credit - t.debit
    return { account: a, debit: t.debit, credit: t.credit, balance }
  })
}

export interface ProfitLoss {
  revenues: LedgerRow[]
  expenses: LedgerRow[]
  totalRevenue: number
  totalExpense: number
  netProfit: number
}

export function computeProfitLoss(ledger: LedgerRow[]): ProfitLoss {
  const revenues = ledger.filter((row) => row.account.type === 'revenue')
  const expenses = ledger.filter((row) => row.account.type === 'expense')
  const totalRevenue = revenues.reduce((s, row) => s + row.balance, 0)
  const totalExpense = expenses.reduce((s, row) => s + row.balance, 0)
  return { revenues, expenses, totalRevenue, totalExpense, netProfit: totalRevenue - totalExpense }
}

export interface BalanceSheet {
  assets: LedgerRow[]
  liabilities: LedgerRow[]
  equity: LedgerRow[]
  totalAssets: number
  totalLiabilities: number
  totalEquityBase: number
  totalEquity: number
  netProfit: number
  balanced: boolean
}

export function computeBalanceSheet(ledger: LedgerRow[], netProfit: number): BalanceSheet {
  const assets = ledger.filter((row) => row.account.type === 'asset')
  const liabilities = ledger.filter((row) => row.account.type === 'liability')
  const equity = ledger.filter((row) => row.account.type === 'equity')
  const totalAssets = assets.reduce((s, row) => s + row.balance, 0)
  const totalLiabilities = liabilities.reduce((s, row) => s + row.balance, 0)
  const totalEquityBase = equity.reduce((s, row) => s + row.balance, 0)
  const totalEquity = totalEquityBase + netProfit // laba berjalan masuk ekuitas
  return {
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquityBase,
    totalEquity,
    netProfit,
    balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1,
  }
}

// ─── Arus Kas (metode langsung, diklasifikasi) ───
export interface CashFlowItem { label: string; amount: number } // + masuk, − keluar
export interface CashFlow {
  operating: CashFlowItem[]
  investing: CashFlowItem[]
  financing: CashFlowItem[]
  totalOperating: number
  totalInvesting: number
  totalFinancing: number
  beginningCash: number
  netChange: number
  endingCash: number
}

export function computeCashFlow(accounts: Account[], entries: JournalEntry[], cutoff: number): CashFlow {
  const byId = new Map(accounts.map((a) => [a.id, a]))
  const cashIds = new Set(accounts.filter((a) => a.code === ACC.CASH || a.code === ACC.BANK).map((a) => a.id))
  const cashDelta = (e: JournalEntry) => e.lines.reduce((s, l) => s + (cashIds.has(l.account_id) ? l.debit - l.credit : 0), 0)

  const classify = (e: JournalEntry): 'operating' | 'investing' | 'financing' => {
    const others = e.lines.filter((l) => !cashIds.has(l.account_id))
    if (others.some((l) => { const a = byId.get(l.account_id); return a?.code === '1-200' || a?.code === '1-210' })) return 'investing'
    if (others.some((l) => byId.get(l.account_id)?.type === 'equity')) return 'financing'
    return 'operating'
  }

  let beginningCash = 0
  const groups: Record<'operating' | 'investing' | 'financing', Map<string, number>> = { operating: new Map(), investing: new Map(), financing: new Map() }
  for (const e of entries) {
    const delta = cashDelta(e)
    if (delta === 0) continue
    if (new Date(e.date).getTime() < cutoff) { beginningCash += delta; continue }
    const cat = classify(e)
    const others = e.lines.filter((l) => !cashIds.has(l.account_id))
    const label = others[0]?.account_name ?? e.description
    groups[cat].set(label, (groups[cat].get(label) ?? 0) + delta)
  }
  const toItems = (m: Map<string, number>) => [...m.entries()].map(([label, amount]) => ({ label, amount })).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
  const operating = toItems(groups.operating)
  const investing = toItems(groups.investing)
  const financing = toItems(groups.financing)
  const totalOperating = operating.reduce((s, i) => s + i.amount, 0)
  const totalInvesting = investing.reduce((s, i) => s + i.amount, 0)
  const totalFinancing = financing.reduce((s, i) => s + i.amount, 0)
  const netChange = totalOperating + totalInvesting + totalFinancing
  return { operating, investing, financing, totalOperating, totalInvesting, totalFinancing, beginningCash, netChange, endingCash: beginningCash + netChange }
}

// ─── Umur Piutang/Hutang (aging, FIFO level-akun) ───
export interface AgingItem { date: string; number: string; description: string; amount: number; ageDays: number; bucket: string }
export interface Aging { items: AgingItem[]; total: number; buckets: { label: string; amount: number }[] }

const AGING_BUCKETS = ['0–30', '31–60', '61–90', '>90']
function bucketOf(ageDays: number) {
  return ageDays <= 30 ? AGING_BUCKETS[0] : ageDays <= 60 ? AGING_BUCKETS[1] : ageDays <= 90 ? AGING_BUCKETS[2] : AGING_BUCKETS[3]
}

/** Aging saldo akun (mis. Piutang Usaha) via pelunasan FIFO atas mutasi penambah. */
export function computeAging(accounts: Account[], entries: JournalEntry[], accountCode: string, asOf: number): Aging {
  const acc = accounts.find((a) => a.code === accountCode)
  if (!acc) return { items: [], total: 0, buckets: AGING_BUCKETS.map((label) => ({ label, amount: 0 })) }
  const debitNormal = normalBalance(acc.type) === 'debit'
  const muts = entries
    .flatMap((e) => e.lines.filter((l) => l.account_id === acc.id).map((l) => ({
      date: e.date, number: e.number, description: e.description,
      inc: debitNormal ? l.debit - l.credit : l.credit - l.debit, // + menambah saldo terutang
    })))
    .sort((a, b) => a.date.localeCompare(b.date))

  const open: { date: string; number: string; description: string; amount: number }[] = []
  for (const m of muts) {
    if (m.inc > 0) open.push({ date: m.date, number: m.number, description: m.description, amount: m.inc })
    else {
      let pay = -m.inc
      while (pay > 0.001 && open.length) {
        const head = open[0]
        const used = Math.min(head.amount, pay)
        head.amount -= used; pay -= used
        if (head.amount <= 0.001) open.shift()
      }
    }
  }
  const items: AgingItem[] = open.map((o) => {
    const ageDays = Math.max(0, Math.floor((asOf - new Date(o.date).getTime()) / 86400000))
    return { ...o, ageDays, bucket: bucketOf(ageDays) }
  })
  const total = items.reduce((s, i) => s + i.amount, 0)
  const buckets = AGING_BUCKETS.map((label) => ({ label, amount: items.filter((i) => i.bucket === label).reduce((s, i) => s + i.amount, 0) }))
  return { items, total, buckets }
}

// ─── Penyusutan garis lurus ───
export interface Depreciation { monthly: number; monthsElapsed: number; accumulated: number; bookValue: number }

export function depreciation(asset: Asset, asOf: Date): Depreciation {
  const base = asset.cost - asset.salvage
  const monthly = asset.useful_life_months > 0 ? base / asset.useful_life_months : 0
  const start = new Date(asset.acquired_at)
  const monthsElapsed = Math.max(0, (asOf.getFullYear() - start.getFullYear()) * 12 + (asOf.getMonth() - start.getMonth()))
  const eff = Math.min(monthsElapsed, asset.useful_life_months)
  const accumulated = Math.round(monthly * eff)
  return { monthly: Math.round(monthly), monthsElapsed, accumulated, bookValue: asset.cost - accumulated }
}

import type { Transaction } from '@/types'

type PayLike = Pick<Transaction, 'payment_method' | 'total'> & { payment_details?: Record<string, number> | null }

/**
 * Rincian pembayaran sebuah transaksi per metode → { cash: 50000, transfer_bca: 50000 }.
 *
 * Transaksi SPLIT menyimpan rinciannya di payment_details tapi payment_method-nya 'split' —
 * sehingga laporan per metode, kas laci shift, dan jurnal dulu menganggapnya satu metode
 * "split" tersendiri: uang tunainya tak masuk kas, transfernya tak masuk bank.
 * Semua penjumlahan per metode WAJIB lewat fungsi ini supaya konsisten.
 */
export function paymentBreakdown(t: PayLike): Record<string, number> {
  const d = t.payment_details
  if (t.payment_method === 'split' && d && typeof d === 'object') {
    const out: Record<string, number> = {}
    for (const [m, v] of Object.entries(d)) {
      const n = Number(v)
      if (n > 0) out[m] = (out[m] ?? 0) + n
    }
    if (Object.keys(out).length) return out
  }
  // Non-split (atau split tanpa rincian): seluruh total ke metode utamanya.
  return { [t.payment_method]: t.total }
}

/** Bagian tunai dari sebuah transaksi (untuk kas laci) — split ikut dihitung porsinya. */
export function cashPortion(t: PayLike): number {
  return paymentBreakdown(t).cash ?? 0
}

/** Apakah pembayaran ini split (punya >1 metode)? */
export function isSplit(t: PayLike): boolean {
  return t.payment_method === 'split' && Object.keys(paymentBreakdown(t)).length > 1
}

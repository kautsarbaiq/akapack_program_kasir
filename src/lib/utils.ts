import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Skor relevansi `query` terhadap beberapa field (nama, sku, barcode, dll).
 * 0 = tidak cocok. Makin besar makin relevan:
 *   100 sama persis · 88 diawali query · 70 ada kata diawali query · 55 mengandung query ·
 *   45 semua kata query di awal kata · 35 semua kata query terkandung — +4 bila cocok di field pertama (nama).
 * Dipakai untuk MENGURUTKAN hasil pencarian agar yang paling cocok muncul di ATAS.
 */
const WORD_SPLIT = /[\s\-/.,()|*]+/
// "15x20"/"15×20" → "15 20" (pisah dimensi), TANPA merusak kata ber-x seperti "box"/"mixer".
const splitDims = (s: string) => s.replace(/(\d)\s*[x×]\s*(\d)/gi, '$1 $2')

export function matchScore(query: string, ...fields: Array<string | null | undefined>): number {
  const q = query.trim().toLowerCase()
  if (!q) return 1
  const tokens = splitDims(q).split(/\s+/) // multi-kata (urutan bebas); "15x20" ikut terpecah 15 & 20
  let best = 0
  for (let fi = 0; fi < fields.length; fi++) {
    const s = (fields[fi] ?? '').toString().toLowerCase()
    if (!s) continue
    // Bonus kecil bila cocok di field PERTAMA (nama produk) — "sesuai nama" naik duluan.
    const bonus = fi === 0 ? 4 : 0
    if (s === q) return 100
    if (s.startsWith(q)) { best = Math.max(best, 88 + bonus); continue }
    const words = splitDims(s).split(WORD_SPLIT)
    if (words.some((w) => w.startsWith(q))) { best = Math.max(best, 70 + bonus); continue }
    if (s.includes(q)) { best = Math.max(best, 55 + bonus); continue }
    // Multi-kata: SEMUA kata query harus ada di field ini (urutan bebas, boleh terpencar) —
    // mis. "alba 250" tetap menemukan "Botol Alba Almon 250Ml".
    if (tokens.length > 1) {
      let allWordStart = true
      let allFound = true
      for (const t of tokens) {
        if (words.some((w) => w.startsWith(t))) continue
        allWordStart = false
        if (!s.includes(t)) { allFound = false; break }
      }
      if (allFound) best = Math.max(best, (allWordStart ? 45 : 35) + bonus)
    }
  }
  return best
}

/**
 * Filter + urutkan daftar berdasar relevansi pencarian.
 * Item dengan skor 0 dibuang; sisanya diurutkan skor (desc), lalu tiebreak alfabetis via `getName`.
 * Saat `query` kosong, daftar dikembalikan apa adanya (urutan asli, tanpa filter).
 */
export function rankedSearch<T>(
  items: T[],
  query: string,
  getFields: (item: T) => Array<string | null | undefined>,
  getName?: (item: T) => string,
): T[] {
  if (!query.trim()) return items
  return items
    .map((item) => ({ item, s: matchScore(query, ...getFields(item)), n: getName ? getName(item) : '' }))
    .filter((x) => x.s > 0)
    // Skor desc → nama TERPENDEK dulu (paling spesifik/pas) → alfabetis.
    .sort((a, b) => b.s - a.s || a.n.length - b.n.length || a.n.localeCompare(b.n))
    .map((x) => x.item)
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('id-ID').format(num)
}

/** Ubah angka rupiah ke kata (Bahasa Indonesia). mis. 14100000 → "empat belas juta seratus ribu". */
export function terbilang(value: number): string {
  const n = Math.floor(Math.abs(value || 0))
  if (n === 0) return 'nol'
  const satuan = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas']
  const words = (x: number): string => {
    if (x < 12) return satuan[x]
    if (x < 20) return words(x - 10) + ' belas'
    if (x < 100) return words(Math.floor(x / 10)) + ' puluh' + (x % 10 ? ' ' + satuan[x % 10] : '')
    if (x < 200) return 'seratus' + (x - 100 ? ' ' + words(x - 100) : '')
    if (x < 1000) return words(Math.floor(x / 100)) + ' ratus' + (x % 100 ? ' ' + words(x % 100) : '')
    if (x < 2000) return 'seribu' + (x - 1000 ? ' ' + words(x - 1000) : '')
    if (x < 1_000_000) return words(Math.floor(x / 1000)) + ' ribu' + (x % 1000 ? ' ' + words(x % 1000) : '')
    if (x < 1_000_000_000) return words(Math.floor(x / 1_000_000)) + ' juta' + (x % 1_000_000 ? ' ' + words(x % 1_000_000) : '')
    if (x < 1_000_000_000_000) return words(Math.floor(x / 1_000_000_000)) + ' miliar' + (x % 1_000_000_000 ? ' ' + words(x % 1_000_000_000) : '')
    return words(Math.floor(x / 1_000_000_000_000)) + ' triliun' + (x % 1_000_000_000_000 ? ' ' + words(x % 1_000_000_000_000) : '')
  }
  return words(n).replace(/\s+/g, ' ').trim()
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatDateShort(date: Date | string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

/** Tanggal hari LOKAL sebagai 'YYYY-MM-DD' (zona waktu runtime, mis. WIB) — untuk bucketing absensi. */
export function localDay(date: Date | string): string {
  return new Date(date).toLocaleDateString('sv-SE')
}

export function formatTime(date: Date | string): string {
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function generateSKU(prefix: string = 'PRD'): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 5).toUpperCase()
  return `${prefix}-${timestamp}-${random}`
}

export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 7)
  return `${prefix}-${timestamp}${random}`
}

export function generateVoucherCode(length: number = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/** Tag cabang 1 huruf untuk nomor transaksi (Bandung→B, Garut→G, else huruf pertama). */
export function branchTag(outletName?: string): string {
  const n = (outletName || '').toLowerCase()
  if (n.includes('garut')) return 'G'
  if (n.includes('bandung')) return 'B'
  return (outletName?.trim()[0] || 'X').toUpperCase()
}

/**
 * Nomor transaksi BERURUTAN per-cabang per-hari (gaya buku faktur): TRX-YYYYMMDD-{B|G}{NNNN}.
 * Dihitung dari nomor yang SUDAH ada di store (hari & cabang sama) → +1. Unik, terurut, tanpa
 * lompatan acak yang bikin owner mengira ada transaksi "hilang". Pakai tanggal LOKAL.
 */
export function nextTransactionNumber(existingNumbers: string[], outletName?: string, now: Date = new Date()): string {
  const ymd = localDay(now).replace(/-/g, '')
  const prefix = `TRX-${ymd}-${branchTag(outletName)}`
  const max = existingNumbers.reduce((mx, num) => {
    if (!num?.startsWith(prefix)) return mx
    const seq = parseInt(num.slice(prefix.length), 10)
    return Number.isNaN(seq) ? mx : Math.max(mx, seq)
  }, 0)
  return `${prefix}${String(max + 1).padStart(4, '0')}`
}

/** @deprecated pakai nextTransactionNumber (acak lama sering bentrok). Disisakan utk fallback. */
export function generateTransactionNumber(): string {
  const now = new Date()
  const date = localDay(now).replace(/-/g, '')
  return `TRX-${date}-${now.getHours()}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}${String(now.getMilliseconds()).padStart(3, '0')}`
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

export function truncate(str: string, length: number): string {
  return str.length > length ? str.slice(0, length) + '...' : str
}

export function calculateChange(total: number, paid: number): number {
  return Math.max(0, paid - total)
}

export function calculateTax(amount: number, taxRate: number): number {
  return Math.round(amount * (taxRate / 100))
}

export function calculateDiscount(
  amount: number,
  discount: number,
  type: 'fixed' | 'percentage'
): number {
  if (type === 'percentage') {
    return Math.round(amount * (discount / 100))
  }
  return Math.min(discount, amount)
}

export function getStockStatus(
  stock: number,
  minStock: number
): 'safe' | 'low' | 'out' {
  if (stock === 0) return 'out'
  if (stock <= minStock) return 'low'
  return 'safe'
}

/** Normalisasi nomor HP Indonesia ke format internasional tanpa "+" (0812… → 62812…). */
export function normalizePhoneId(phone: string): string {
  const raw = (phone ?? '').replace(/\D/g, '')
  if (!raw) return ''
  if (raw.startsWith('62')) return raw
  if (raw.startsWith('0')) return '62' + raw.slice(1)
  return raw
}

/** Bangun link wa.me. Tanpa nomor → buka WhatsApp dengan teks siap kirim (pilih kontak sendiri). */
export function waUrl(phone: string, text: string): string {
  const num = normalizePhoneId(phone)
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`
}

/** Unduh data tabel sebagai CSV (UTF-8 BOM agar rapi di Excel). */
export function exportCsv(filename: string, rows: (string | number)[][]): void {
  const csv = rows
    .map((r) => r.map((c) => {
      const s = String(c ?? '')
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }).join(','))
    .join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function getAvatarColor(name: string): string {
  const colors = [
    'bg-blue-500',
    'bg-emerald-500',
    'bg-violet-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-cyan-500',
    'bg-orange-500',
    'bg-pink-500',
  ]
  const index = name.charCodeAt(0) % colors.length
  return colors[index]
}

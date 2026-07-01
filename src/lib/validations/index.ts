// ═══════════════════════════════════════
// AKAPACK — Zod Validation Schemas (terpusat)
// Sumber tunggal untuk schema form + tipe FormValues.
// Pola: field numerik = z.number() (register pakai { valueAsNumber: true }),
// default 0 agar tidak NaN. Tidak pakai z.coerce agar tipe resolver bersih.
// ═══════════════════════════════════════

import { z } from 'zod'

// Helper: validasi email opsional (boleh kosong)
const optionalEmail = z
  .string()
  .optional()
  .refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), 'Format email tidak valid')

// Helper: validasi no. HP opsional (boleh kosong, min 8 digit jika diisi)
const optionalPhone = z
  .string()
  .optional()
  .refine((v) => !v || /^[0-9+\-\s]{8,}$/.test(v), 'No. HP minimal 8 digit')

// ─── Kategori ──────────────────────────
export const categorySchema = z.object({
  name: z.string().min(2, 'Nama kategori minimal 2 karakter'),
  color: z.string().min(1, 'Pilih warna'),
  icon: z.string().min(1, 'Pilih ikon'),
  is_active: z.boolean(),
})
export type CategoryFormValues = z.infer<typeof categorySchema>

// ─── Produk ────────────────────────────
export const productSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  category_id: z.string().min(1, 'Pilih kategori'),
  sku: z.string().min(1, 'SKU wajib diisi'),
  barcode: z.string().optional(),
  description: z.string().optional(),
  price: z.number().min(1, 'Harga jual wajib diisi'),
  cost_price: z.number().min(0, 'HPP tidak boleh negatif'),
  stock: z.number().min(0, 'Stok tidak boleh negatif'),
  min_stock: z.number().min(0, 'Min stok tidak boleh negatif'),
  unit: z.string().min(1, 'Pilih satuan'),
  is_active: z.boolean(),
})
export type ProductFormValues = z.infer<typeof productSchema>

// ─── Pelanggan ─────────────────────────
export const customerSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  phone: optionalPhone,
  email: optionalEmail,
  address: z.string().optional(),
  points: z.number().min(0, 'Poin tidak boleh negatif'),
})
export type CustomerFormValues = z.infer<typeof customerSchema>

// ─── Karyawan ──────────────────────────
export const employeeSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  role: z.enum(['owner', 'manager', 'cashier', 'sales']),
  outlet_id: z.string().optional(), // cabang tempat karyawan bekerja (kosong = semua, utk owner)
  phone: optionalPhone,
  email: optionalEmail,
  pin: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{4,6}$/.test(v), 'PIN harus 4-6 digit angka'),
  is_active: z.boolean(),
})
export type EmployeeFormValues = z.infer<typeof employeeSchema>

// ─── Promosi ───────────────────────────
export const promotionSchema = z
  .object({
    name: z.string().min(2, 'Nama promosi minimal 2 karakter'),
    type: z.enum(['percentage', 'fixed', 'bogo', 'bundle']),
    value: z.number().min(0, 'Nilai tidak boleh negatif'),
    min_purchase: z.number().min(0, 'Minimal pembelian tidak boleh negatif'),
    code: z.string().optional(),
    max_uses: z.number().min(0, 'Maks. penggunaan tidak boleh negatif'),
    starts_at: z.string().min(1, 'Tanggal mulai wajib diisi'),
    ends_at: z.string().min(1, 'Tanggal berakhir wajib diisi'),
    is_active: z.boolean(),
  })
  .refine((d) => d.ends_at >= d.starts_at, {
    message: 'Tanggal berakhir harus setelah tanggal mulai',
    path: ['ends_at'],
  })
  .refine((d) => d.type !== 'percentage' || d.value <= 100, {
    message: 'Persentase maksimal 100%',
    path: ['value'],
  })
export type PromotionFormValues = z.infer<typeof promotionSchema>

// ─── Shift Kasir ───────────────────────
export const openShiftSchema = z.object({
  employee_id: z.string().min(1, 'Pilih kasir'),
  opening_cash: z.number().min(0, 'Kas awal tidak boleh negatif'),
})
export type OpenShiftFormValues = z.infer<typeof openShiftSchema>

export const closeShiftSchema = z.object({
  closing_cash: z.number().min(0, 'Kas akhir tidak boleh negatif'),
})
export type CloseShiftFormValues = z.infer<typeof closeShiftSchema>

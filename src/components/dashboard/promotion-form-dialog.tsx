'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Tag, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { usePromotionStore } from '@/stores/use-promotion-store'
import { promotionSchema, type PromotionFormValues } from '@/lib/validations'
import { generateVoucherCode } from '@/lib/utils'
import type { Promotion, PromotionType } from '@/types'

const TYPES: { value: PromotionType; label: string }[] = [
  { value: 'percentage', label: 'Diskon Persen (%)' },
  { value: 'fixed', label: 'Diskon Nominal (Rp)' },
  { value: 'bogo', label: 'Buy X Get Y (BOGO)' },
  { value: 'bundle', label: 'Bundle / Paket' },
]

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  promotion?: Promotion | null
  onSuccess?: () => void
}

export function PromotionFormDialog({ open, onOpenChange, promotion, onSuccess }: Props) {
  const isEdit = !!promotion
  const addPromotion = usePromotionStore((s) => s.addPromotion)
  const updatePromotion = usePromotionStore((s) => s.updatePromotion)

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<PromotionFormValues>({
    resolver: zodResolver(promotionSchema),
    defaultValues: {
      name: '', type: 'percentage', value: 0, min_purchase: 0,
      code: '', max_uses: 0, starts_at: todayISO(), ends_at: todayISO(), is_active: true,
    },
  })

  const type = watch('type')
  const isActive = watch('is_active')
  const isPercentage = type === 'percentage'

  useEffect(() => {
    if (open) {
      if (promotion) {
        reset({
          name: promotion.name,
          type: promotion.type,
          value: promotion.value,
          min_purchase: promotion.min_purchase ?? 0,
          code: promotion.code ?? '',
          max_uses: promotion.max_uses ?? 0,
          starts_at: promotion.starts_at.slice(0, 10),
          ends_at: promotion.ends_at.slice(0, 10),
          is_active: promotion.is_active,
        })
      } else {
        reset({
          name: '', type: 'percentage', value: 0, min_purchase: 0,
          code: '', max_uses: 0, starts_at: todayISO(), ends_at: todayISO(), is_active: true,
        })
      }
    }
  }, [open, promotion, reset])

  const onSubmit = async (data: PromotionFormValues) => {
    await new Promise((r) => setTimeout(r, 300))
    if (isEdit && promotion) {
      updatePromotion(promotion.id, data)
      toast.success(`Promosi "${data.name}" berhasil diperbarui`)
    } else {
      addPromotion(data)
      toast.success(`Promosi "${data.name}" berhasil dibuat`)
    }
    onOpenChange(false)
    onSuccess?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag size={18} />
            {isEdit ? 'Edit Promosi' : 'Buat Promosi Baru'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Nama Promosi *</Label>
            <Input placeholder="Contoh: Diskon Akhir Pekan" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipe Promosi *</Label>
              <Select value={type} onValueChange={(v) => { if (v) setValue('type', v as PromotionType, { shouldValidate: true }) }}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih tipe..." />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{isPercentage ? 'Nilai Diskon (%)' : 'Nilai Diskon (Rp)'} *</Label>
              <div className="relative">
                {!isPercentage && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>}
                <Input type="number" className={isPercentage ? '' : 'pl-9'} placeholder="0" {...register('value', { valueAsNumber: true })} />
                {isPercentage && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>}
              </div>
              {errors.value && <p className="text-xs text-destructive">{errors.value.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Min. Pembelian (Rp)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
                <Input type="number" className="pl-9" placeholder="0" {...register('min_purchase', { valueAsNumber: true })} />
              </div>
              <p className="text-xs text-muted-foreground">0 = tanpa minimum</p>
            </div>
            <div className="space-y-2">
              <Label>Maks. Penggunaan</Label>
              <Input type="number" placeholder="0" {...register('max_uses', { valueAsNumber: true })} />
              <p className="text-xs text-muted-foreground">0 = tidak terbatas</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Kode Voucher</Label>
            <div className="flex gap-2">
              <Input placeholder="Kosongkan jika otomatis tanpa kode" className="font-mono uppercase" {...register('code')} />
              <Button type="button" variant="outline" size="icon" onClick={() => setValue('code', generateVoucherCode())} title="Generate kode acak">
                <Wand2 size={15} />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tanggal Mulai *</Label>
              <Input type="date" {...register('starts_at')} />
              {errors.starts_at && <p className="text-xs text-destructive">{errors.starts_at.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Tanggal Berakhir *</Label>
              <Input type="date" {...register('ends_at')} />
              {errors.ends_at && <p className="text-xs text-destructive">{errors.ends_at.message}</p>}
            </div>
          </div>

          <div className="flex items-center justify-between py-2 rounded-lg px-3 bg-muted/50">
            <div>
              <p className="text-sm font-medium">Status Promosi</p>
              <p className="text-xs text-muted-foreground">{isActive ? 'Aktif & berlaku' : 'Tidak aktif'}</p>
            </div>
            <Switch checked={isActive} onCheckedChange={(v) => setValue('is_active', v)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Batal</Button>
            <Button type="submit" disabled={isSubmitting} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {isSubmitting && <Loader2 size={15} className="animate-spin mr-1.5" />}
              {isEdit ? 'Simpan Perubahan' : 'Buat Promosi'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

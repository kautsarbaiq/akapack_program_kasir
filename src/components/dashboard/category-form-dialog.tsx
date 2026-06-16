'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Tag, Check } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useCategoryStore } from '@/stores/use-category-store'
import { categorySchema, type CategoryFormValues } from '@/lib/validations'
import { cn } from '@/lib/utils'
import type { Category } from '@/types'

const COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#EF4444', '#06B6D4', '#EC4899', '#F97316', '#14B8A6', '#6366F1']
const EMOJIS = ['📦', '👕', '👖', '👗', '👜', '🎒', '💻', '📱', '🎧', '⌚', '🍜', '🍱', '🍰', '☕', '🥤', '✏️', '📚', '🧴', '💊', '🧸', '⚽', '🏠', '🔧', '🎨']

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  category?: Category | null
  onSuccess?: () => void
}

export function CategoryFormDialog({ open, onOpenChange, category, onSuccess }: Props) {
  const isEdit = !!category
  const addCategory = useCategoryStore((s) => s.addCategory)
  const updateCategory = useCategoryStore((s) => s.updateCategory)

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', color: COLORS[0], icon: EMOJIS[0], is_active: true },
  })

  const color = watch('color')
  const icon = watch('icon')
  const isActive = watch('is_active')

  useEffect(() => {
    if (open) {
      if (category) {
        reset({
          name: category.name,
          color: category.color ?? COLORS[0],
          // icon lama bisa berupa nama lucide ('Shirt'); pakai hanya jika sudah emoji
          icon: category.icon && !/^[A-Za-z]/.test(category.icon) ? category.icon : EMOJIS[0],
          is_active: category.is_active,
        })
      } else {
        reset({ name: '', color: COLORS[0], icon: EMOJIS[0], is_active: true })
      }
    }
  }, [open, category, reset])

  const onSubmit = async (data: CategoryFormValues) => {
    await new Promise((r) => setTimeout(r, 300))
    if (isEdit && category) {
      updateCategory(category.id, data)
      toast.success(`Kategori "${data.name}" berhasil diperbarui`)
    } else {
      addCategory(data)
      toast.success(`Kategori "${data.name}" berhasil ditambahkan`)
    }
    onOpenChange(false)
    onSuccess?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag size={18} />
            {isEdit ? 'Edit Kategori' : 'Tambah Kategori Baru'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Live preview */}
          <div className="flex items-center justify-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl" style={{ background: `${color}20` }}>
              {icon}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Nama Kategori *</Label>
            <Input placeholder="Contoh: Pakaian" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Warna</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setValue('color', c, { shouldValidate: true })}
                  className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center"
                  style={{ background: c, borderColor: color === c ? 'var(--foreground)' : 'transparent' }}
                >
                  {color === c && <Check size={14} className="text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Ikon</Label>
            <div className="grid grid-cols-8 gap-1.5">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setValue('icon', e, { shouldValidate: true })}
                  className={cn(
                    'aspect-square rounded-lg text-xl flex items-center justify-center transition-colors',
                    icon === e ? 'bg-primary/15 ring-2 ring-primary' : 'hover:bg-muted'
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between py-2 rounded-lg px-3 bg-muted/50">
            <div>
              <p className="text-sm font-medium">Status Kategori</p>
              <p className="text-xs text-muted-foreground">{isActive ? 'Aktif' : 'Tidak aktif'} di katalog</p>
            </div>
            <Switch checked={isActive} onCheckedChange={(v) => setValue('is_active', v)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Batal</Button>
            <Button type="submit" disabled={isSubmitting} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {isSubmitting && <Loader2 size={15} className="animate-spin mr-1.5" />}
              {isEdit ? 'Simpan Perubahan' : 'Tambah Kategori'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

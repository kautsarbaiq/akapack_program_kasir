'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCustomerStore } from '@/stores/use-customer-store'
import { customerSchema, type CustomerFormValues } from '@/lib/validations'
import type { Customer } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer?: Customer | null
  onSuccess?: () => void
}

export function CustomerFormDialog({ open, onOpenChange, customer, onSuccess }: Props) {
  const isEdit = !!customer
  const addCustomer = useCustomerStore((s) => s.addCustomer)
  const updateCustomer = useCustomerStore((s) => s.updateCustomer)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: '', phone: '', email: '', address: '', points: 0 },
  })

  useEffect(() => {
    if (open) {
      if (customer) {
        reset({
          name: customer.name,
          phone: customer.phone ?? '',
          email: customer.email ?? '',
          address: customer.address ?? '',
          points: customer.points,
        })
      } else {
        reset({ name: '', phone: '', email: '', address: '', points: 0 })
      }
    }
  }, [open, customer, reset])

  const onSubmit = async (data: CustomerFormValues) => {
    await new Promise((r) => setTimeout(r, 300))
    if (isEdit && customer) {
      updateCustomer(customer.id, data)
      toast.success(`Data "${data.name}" berhasil diperbarui`)
    } else {
      addCustomer(data)
      toast.success(`Pelanggan "${data.name}" berhasil ditambahkan`)
    }
    onOpenChange(false)
    onSuccess?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus size={18} />
            {isEdit ? 'Edit Pelanggan' : 'Tambah Pelanggan Baru'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Nama Pelanggan *</Label>
            <Input placeholder="Contoh: Budi Santoso" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>No. HP</Label>
              <Input placeholder="08123456789" {...register('phone')} />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>{isEdit ? 'Poin' : 'Poin Awal'}</Label>
              <Input type="number" placeholder="0" {...register('points', { valueAsNumber: true })} />
              {errors.points && <p className="text-xs text-destructive">{errors.points.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" placeholder="email@contoh.com" {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Alamat</Label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[70px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Alamat lengkap (opsional)"
              {...register('address')}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Batal</Button>
            <Button type="submit" disabled={isSubmitting} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {isSubmitting && <Loader2 size={15} className="animate-spin mr-1.5" />}
              {isEdit ? 'Simpan Perubahan' : 'Tambah Pelanggan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

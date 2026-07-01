'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, UserCog } from 'lucide-react'
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
import { useEmployeeStore } from '@/stores/use-employee-store'
import { useOutletStore } from '@/stores/use-outlet-store'
import { employeeSchema, type EmployeeFormValues } from '@/lib/validations'
import type { Employee, UserRole } from '@/types'

const ROLES: { value: UserRole; label: string; desc: string }[] = [
  { value: 'owner', label: 'Pemilik / Owner', desc: 'Akses penuh ke semua fitur' },
  { value: 'manager', label: 'Manager', desc: 'Kelola produk, laporan, karyawan' },
  { value: 'cashier', label: 'Kasir', desc: 'Akses POS & transaksi' },
  { value: 'sales', label: 'Sales', desc: 'Buat surat pesanan / order penjualan' },
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee?: Employee | null
  onSuccess?: () => void
}

export function EmployeeFormDialog({ open, onOpenChange, employee, onSuccess }: Props) {
  const isEdit = !!employee
  const addEmployee = useEmployeeStore((s) => s.addEmployee)
  const updateEmployee = useEmployeeStore((s) => s.updateEmployee)
  const outlets = useOutletStore((s) => s.outlets)

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: { name: '', role: 'cashier', outlet_id: '', phone: '', email: '', pin: '', is_active: true },
  })

  const role = watch('role')
  const isActive = watch('is_active')
  const outletId = watch('outlet_id')
  const outletLabel = outletId ? (outlets.find((o) => o.id === outletId)?.name ?? 'Pilih cabang') : 'Semua cabang (owner)'

  useEffect(() => {
    if (open) {
      if (employee) {
        reset({
          name: employee.name,
          role: employee.role,
          outlet_id: employee.outlet_id ?? '',
          phone: employee.phone ?? '',
          email: employee.email ?? '',
          pin: employee.pin ?? '',
          is_active: employee.is_active,
        })
      } else {
        reset({ name: '', role: 'cashier', outlet_id: '', phone: '', email: '', pin: '', is_active: true })
      }
    }
  }, [open, employee, reset])

  const onSubmit = async (data: EmployeeFormValues) => {
    await new Promise((r) => setTimeout(r, 300))
    if (isEdit && employee) {
      updateEmployee(employee.id, data)
      toast.success(`Karyawan "${data.name}" berhasil diperbarui`)
    } else {
      addEmployee(data)
      toast.success(`Karyawan "${data.name}" berhasil ditambahkan`)
    }
    onOpenChange(false)
    onSuccess?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog size={18} />
            {isEdit ? 'Edit Karyawan' : 'Tambah Karyawan Baru'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Nama Lengkap *</Label>
            <Input placeholder="Contoh: Riko Andrian" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Role / Jabatan *</Label>
            <Select value={role} onValueChange={(v) => { if (v) setValue('role', v as UserRole, { shouldValidate: true }) }}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih role..." />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    <div className="flex flex-col">
                      <span>{r.label}</span>
                      <span className="text-xs text-muted-foreground">{r.desc}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Cabang *</Label>
            <Select value={outletId || 'ALL'} onValueChange={(v) => setValue('outlet_id', !v || v === 'ALL' ? '' : v, { shouldValidate: true })}>
              <SelectTrigger>
                <span className="flex-1 text-left">{outletLabel}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua cabang (owner)</SelectItem>
                {outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Kasir wajib pilih cabang (Bandung / Garut). Owner pilih &quot;Semua cabang&quot;.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>No. HP</Label>
              <Input placeholder="08123456789" {...register('phone')} />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>PIN Kasir</Label>
              <Input placeholder="4-6 digit" inputMode="numeric" {...register('pin')} />
              {errors.pin && <p className="text-xs text-destructive">{errors.pin.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" placeholder="email@contoh.com" {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="flex items-center justify-between py-2 rounded-lg px-3 bg-muted/50">
            <div>
              <p className="text-sm font-medium">Status Karyawan</p>
              <p className="text-xs text-muted-foreground">{isActive ? 'Aktif — bisa login & bekerja' : 'Nonaktif — akses ditangguhkan'}</p>
            </div>
            <Switch checked={isActive} onCheckedChange={(v) => setValue('is_active', v)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Batal</Button>
            <Button type="submit" disabled={isSubmitting} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {isSubmitting && <Loader2 size={15} className="animate-spin mr-1.5" />}
              {isEdit ? 'Simpan Perubahan' : 'Tambah Karyawan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

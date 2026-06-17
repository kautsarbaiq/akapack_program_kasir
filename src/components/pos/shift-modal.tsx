'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, PlayCircle, StopCircle } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { useShiftStore } from '@/stores/use-shift-store'
import { useEmployeeStore } from '@/stores/use-employee-store'
import {
  openShiftSchema, type OpenShiftFormValues,
  closeShiftSchema, type CloseShiftFormValues,
} from '@/lib/validations'
import { formatRupiah } from '@/lib/utils'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'open' | 'close'
}

export function ShiftModal({ open, onOpenChange, mode }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {mode === 'open'
          ? <OpenShiftForm onDone={() => onOpenChange(false)} />
          : <CloseShiftForm onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function OpenShiftForm({ onDone }: { onDone: () => void }) {
  const employees = useEmployeeStore((s) => s.employees).filter((e) => e.is_active)
  const openShift = useShiftStore((s) => s.openShift)

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<OpenShiftFormValues>({
    resolver: zodResolver(openShiftSchema),
    defaultValues: { employee_id: '', opening_cash: 0 },
  })
  const employeeId = watch('employee_id')

  useEffect(() => { reset({ employee_id: '', opening_cash: 0 }) }, [reset])

  const onSubmit = async (data: OpenShiftFormValues) => {
    const employee = employees.find((e) => e.id === data.employee_id)
    if (!employee) { toast.error('Kasir tidak ditemukan'); return }
    await new Promise((r) => setTimeout(r, 300))
    openShift(employee, data.opening_cash)
    toast.success(`Shift dibuka — ${employee.name}`)
    onDone()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><PlayCircle size={18} /> Buka Shift Kasir</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label>Kasir Bertugas *</Label>
          <Select value={employeeId} onValueChange={(v) => { if (v) setValue('employee_id', v, { shouldValidate: true }) }}>
            <SelectTrigger><SelectValue placeholder="Pilih kasir..." /></SelectTrigger>
            <SelectContent>
              {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {errors.employee_id && <p className="text-xs text-destructive">{errors.employee_id.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>Kas Awal (Modal Laci) *</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
            <Input type="number" className="pl-9" placeholder="0" {...register('opening_cash', { valueAsNumber: true })} />
          </div>
          {errors.opening_cash && <p className="text-xs text-destructive">{errors.opening_cash.message}</p>}
        </div>
        <DialogFooter>
          <Button type="submit" disabled={isSubmitting} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            {isSubmitting && <Loader2 size={15} className="animate-spin mr-1.5" />}
            Mulai Shift
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

function CloseShiftForm({ onDone }: { onDone: () => void }) {
  const currentShift = useShiftStore((s) => s.currentShift)
  const closeShift = useShiftStore((s) => s.closeShift)

  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm<CloseShiftFormValues>({
    resolver: zodResolver(closeShiftSchema),
    defaultValues: { closing_cash: 0 },
  })
  const closingCash = watch('closing_cash')

  useEffect(() => { reset({ closing_cash: 0 }) }, [reset])

  if (!currentShift) {
    return (
      <>
        <DialogHeader><DialogTitle>Tutup Shift</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground py-4">Tidak ada shift yang sedang berjalan.</p>
        <DialogFooter><Button onClick={onDone} className="w-full">Tutup</Button></DialogFooter>
      </>
    )
  }

  const expectedCash = currentShift.opening_cash + currentShift.total_sales
  const diff = (Number.isFinite(closingCash) ? closingCash : 0) - expectedCash

  const onSubmit = async (data: CloseShiftFormValues) => {
    await new Promise((r) => setTimeout(r, 300))
    const closed = closeShift(data.closing_cash)
    toast.success(`Shift ditutup — total penjualan ${formatRupiah(closed?.total_sales ?? 0)}`)
    onDone()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><StopCircle size={18} /> Tutup Shift Kasir</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="rounded-xl border bg-muted/30 p-4 space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Kasir</span><span className="font-medium">{currentShift.employee?.name}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Kas Awal</span><span>{formatRupiah(currentShift.opening_cash)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Total Transaksi</span><span>{currentShift.total_transactions}x</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Total Penjualan</span><span className="font-semibold">{formatRupiah(currentShift.total_sales)}</span></div>
          <Separator />
          <div className="flex justify-between font-semibold"><span>Kas Seharusnya</span><span>{formatRupiah(expectedCash)}</span></div>
        </div>
        <div className="space-y-2">
          <Label>Kas Akhir (Hitung Fisik Laci) *</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
            <Input type="number" className="pl-9" placeholder="0" {...register('closing_cash', { valueAsNumber: true })} />
          </div>
          {errors.closing_cash && <p className="text-xs text-destructive">{errors.closing_cash.message}</p>}
          {closingCash > 0 && (
            <p className={`text-xs font-medium ${diff === 0 ? 'text-emerald-600' : diff > 0 ? 'text-blue-600' : 'text-destructive'}`}>
              {diff === 0 ? 'Kas sesuai' : diff > 0 ? `Lebih ${formatRupiah(diff)}` : `Kurang ${formatRupiah(Math.abs(diff))}`}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button type="submit" disabled={isSubmitting} variant="destructive" className="w-full">
            {isSubmitting && <Loader2 size={15} className="animate-spin mr-1.5" />}
            Tutup Shift
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

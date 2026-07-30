'use client'

import { useState } from 'react'
import { Users, ArrowLeft, LogIn, Delete } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useEmployeeStore } from '@/stores/use-employee-store'
import { useActiveOutletStore } from '@/stores/use-active-outlet-store'
import { useShiftStore } from '@/stores/use-shift-store'
import { getAvatarColor, getInitials } from '@/lib/utils'
import type { Employee } from '@/types'
import { toast } from 'sonner'

/**
 * Ganti KASIR bertugas TANPA tutup shift: klik nama → masukkan PIN orang tsb → verifikasi →
 * shift tetap terbuka, penjualan berikutnya atas nama kasir baru. Cocok saat pergantian orang.
 */
export function SwitchCashierDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const employees = useEmployeeStore((s) => s.employees)
  const activeOutletId = useActiveOutletStore((s) => s.activeOutletId)
  const currentShift = useShiftStore((s) => s.currentShift)
  const switchOperator = useShiftStore((s) => s.switchOperator)

  const [selected, setSelected] = useState<Employee | null>(null)
  const [pin, setPin] = useState('')

  // Karyawan aktif di cabang ini (kandidat kasir pengganti). Kasir sekarang ditandai.
  const options = employees.filter((e) => e.is_active && e.outlet_id === activeOutletId)

  const reset = () => { setSelected(null); setPin('') }
  const close = (v: boolean) => { onOpenChange(v); if (!v) reset() }

  const confirm = () => {
    if (!selected) return
    const p = pin.trim()
    const ok = (String(selected.pin ?? '') === p && p !== '') || (String(selected.code ?? '') === p && p !== '')
    if (!ok) { toast.error('PIN salah'); setPin(''); return }
    switchOperator(selected)
    toast.success(`Kasir bertugas sekarang: ${selected.name}`)
    close(false)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Users size={18} /> Ganti Kasir Bertugas</DialogTitle>
        </DialogHeader>

        {!selected ? (
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
            <p className="text-xs text-muted-foreground mb-1">Pilih kasir yang akan bertugas — shift tidak ditutup.</p>
            {options.map((e) => {
              const isCurrent = currentShift?.employee?.id === e.id
              return (
                <button key={e.id} onClick={() => { setSelected(e); setPin('') }}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg border text-left hover:border-primary hover:bg-primary/5 transition-colors">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${getAvatarColor(e.name)}`}>{getInitials(e.name)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{e.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{e.role}</p>
                  </div>
                  {isCurrent && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">bertugas</span>}
                </button>
              )
            })}
            {options.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Belum ada karyawan di cabang ini.</p>}
          </div>
        ) : (
          <div className="space-y-4">
            <button onClick={reset} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft size={13} /> Pilih orang lain</button>
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${getAvatarColor(selected.name)}`}>{getInitials(selected.name)}</div>
              <div><p className="font-semibold">{selected.name}</p><p className="text-xs text-muted-foreground capitalize">{selected.role}</p></div>
            </div>
            <div className="h-12 rounded-xl border-2 flex items-center justify-center text-2xl font-bold tracking-[0.4em] tabular-nums bg-muted/30">
              {pin ? '•'.repeat(pin.length) : <span className="text-muted-foreground text-sm tracking-normal font-normal">Masukkan PIN</span>}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <button key={d} onClick={() => setPin((c) => (c.length >= 8 ? c : c + d))} className="h-12 rounded-xl border text-xl font-semibold hover:bg-muted active:scale-95 transition-transform">{d}</button>
              ))}
              <button onClick={() => setPin('')} className="h-12 rounded-xl border text-sm font-medium text-muted-foreground hover:bg-muted">C</button>
              <button onClick={() => setPin((c) => c + '0')} className="h-12 rounded-xl border text-xl font-semibold hover:bg-muted active:scale-95 transition-transform">0</button>
              <button onClick={() => setPin((c) => c.slice(0, -1))} className="h-12 rounded-xl border flex items-center justify-center text-muted-foreground hover:bg-muted"><Delete size={18} /></button>
            </div>
            <Button onClick={confirm} disabled={!pin} className="w-full h-11 gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <LogIn size={16} /> Ganti ke {selected.name.split(' ')[0]}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

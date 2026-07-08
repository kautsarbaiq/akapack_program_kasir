'use client'

import { useState } from 'react'
import { Fingerprint, LogIn, LogOut, Delete, CheckCircle2, Clock } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useEmployeeStore } from '@/stores/use-employee-store'
import { useAttendanceStore } from '@/stores/use-attendance-store'
import { useOutletStore } from '@/stores/use-outlet-store'
import { formatTime, getAvatarColor, getInitials } from '@/lib/utils'
import { toast } from 'sonner'

/**
 * Kiosk absen GLOBAL untuk POS: siapa pun (karyawan cabang aktif) tinggal ketik kodenya
 * untuk clock-in/out TANPA harus login satu per satu. Dialog dibuka dari layar kasir.
 * Mencocokkan kode HANYA ke karyawan aktif di cabang (outlet) yang sedang aktif.
 */
export function AttendanceKioskDialog({ open, onOpenChange, outletId }: { open: boolean; onOpenChange: (v: boolean) => void; outletId: string }) {
  const employees = useEmployeeStore((s) => s.employees)
  const clock = useAttendanceStore((s) => s.clock)
  const lastToday = useAttendanceStore((s) => s.lastToday)
  const outlets = useOutletStore((s) => s.outlets)
  const outletName = outlets.find((o) => o.id === outletId)?.name ?? 'Cabang'

  const [code, setCode] = useState('')
  const [result, setResult] = useState<{ name: string; type: 'in' | 'out'; time: string } | null>(null)

  const activeEmployees = employees.filter((e) => e.is_active && e.outlet_id === outletId)

  const press = (d: string) => setCode((c) => (c.length >= 8 ? c : c + d))
  const backspace = () => setCode((c) => c.slice(0, -1))

  const submit = () => {
    const c = code.trim()
    if (!c) return
    const matches = employees.filter((e) => e.is_active && e.code === c && e.outlet_id === outletId)
    if (matches.length === 0) { toast.error('Kode tidak ditemukan / karyawan nonaktif'); setCode(''); return }
    if (matches.length > 1) { toast.error('Kode dipakai >1 karyawan — hubungi admin'); setCode(''); return }
    const emp = matches[0]
    const { type, time } = clock(emp, outletId)
    setResult({ name: emp.name, type, time })
    toast.success(`${emp.name} ${type === 'in' ? 'masuk' : 'pulang'} ${formatTime(time)}`)
    setCode('')
  }

  const statusOf = (empId: string) => {
    const last = lastToday(empId)
    if (!last) return { label: 'Belum hadir', cls: 'text-muted-foreground' }
    return last.type === 'in'
      ? { label: `Masuk ${formatTime(last.timestamp)}`, cls: 'text-emerald-600' }
      : { label: `Pulang ${formatTime(last.timestamp)}`, cls: 'text-amber-600' }
  }
  const hadirCount = activeEmployees.filter((e) => { const l = lastToday(e.id); return l && l.type === 'in' }).length

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setCode(''); setResult(null) } }}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden">
        <div className="px-5 py-3 border-b bg-muted/30">
          <h2 className="font-bold flex items-center gap-2"><Fingerprint size={18} /> Absen Karyawan</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Ketik kode karyawan untuk masuk / pulang · {hadirCount}/{activeEmployees.length} sedang hadir · {outletName}</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-0">
          {/* Keypad */}
          <div className="p-5 border-r">
            {result && (
              <div className={`mb-3 rounded-xl p-3 flex items-center gap-3 ${result.type === 'in' ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                <CheckCircle2 size={22} className={result.type === 'in' ? 'text-emerald-600' : 'text-amber-600'} />
                <div><p className="font-semibold text-sm">{result.name}</p><p className="text-xs text-muted-foreground">{result.type === 'in' ? 'Absen Masuk' : 'Absen Pulang'} · {formatTime(result.time)}</p></div>
              </div>
            )}
            <div className="h-14 rounded-xl border-2 flex items-center justify-center text-3xl font-bold tracking-[0.3em] tabular-nums mb-3 bg-muted/30">
              {code ? code : <span className="text-muted-foreground text-base tracking-normal font-normal">Kode karyawan…</span>}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <button key={d} onClick={() => press(d)} className="h-14 rounded-xl border text-xl font-semibold hover:bg-muted active:scale-95 transition-transform">{d}</button>
              ))}
              <button onClick={() => setCode('')} className="h-14 rounded-xl border text-sm font-medium text-muted-foreground hover:bg-muted">C</button>
              <button onClick={() => press('0')} className="h-14 rounded-xl border text-xl font-semibold hover:bg-muted active:scale-95 transition-transform">0</button>
              <button onClick={backspace} className="h-14 rounded-xl border flex items-center justify-center text-muted-foreground hover:bg-muted"><Delete size={20} /></button>
            </div>
            <Button onClick={submit} disabled={!code} className="w-full h-12 mt-3 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 text-base">
              <LogIn size={18} /> Absen
            </Button>
          </div>

          {/* Status hari ini */}
          <div className="p-5 max-h-[60vh] overflow-y-auto">
            <p className="text-sm font-semibold flex items-center gap-2 mb-2"><Clock size={15} /> Status Hari Ini</p>
            <div className="space-y-1.5">
              {activeEmployees.map((e) => {
                const st = statusOf(e.id)
                return (
                  <div key={e.id} className="flex items-center gap-2.5 py-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${getAvatarColor(e.name)}`}>{getInitials(e.name)}</div>
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{e.name}</p><p className="text-xs text-muted-foreground">Kode: <span className="font-mono">{e.code ?? '-'}</span></p></div>
                    {st.label.startsWith('Masuk') ? <LogIn size={12} className="text-emerald-600" /> : st.label.startsWith('Pulang') ? <LogOut size={12} className="text-amber-600" /> : null}
                    <span className={`text-xs font-medium ${st.cls}`}>{st.label}</span>
                  </div>
                )
              })}
              {activeEmployees.length === 0 && <p className="text-xs text-muted-foreground py-6 text-center">Belum ada karyawan di cabang ini.</p>}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

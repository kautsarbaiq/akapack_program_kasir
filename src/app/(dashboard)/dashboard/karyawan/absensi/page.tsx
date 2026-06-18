'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Fingerprint, ArrowLeft, LogIn, LogOut, Delete, CheckCircle2, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useEmployeeStore } from '@/stores/use-employee-store'
import { useAttendanceStore } from '@/stores/use-attendance-store'
import { useActiveOutletStore } from '@/stores/use-active-outlet-store'
import { useOutletStore } from '@/stores/use-outlet-store'
import { useCurrentUserStore } from '@/stores/use-current-user-store'
import { formatTime, formatDateTime, getAvatarColor, getInitials, localDay } from '@/lib/utils'
import { toast } from 'sonner'

export default function AbsensiPage() {
  const employees = useEmployeeStore((s) => s.employees)
  const records = useAttendanceStore((s) => s.records)
  const clock = useAttendanceStore((s) => s.clock)
  const lastToday = useAttendanceStore((s) => s.lastToday)
  const activeOutletId = useActiveOutletStore((s) => s.activeOutletId)
  const outlets = useOutletStore((s) => s.outlets)
  const outletName = (id?: string) => outlets.find((o) => o.id === id)?.name ?? '-'
  const me = useCurrentUserStore((s) => s.user)
  // Karyawan login → absen 1-klik untuk dirinya. Cocokkan id (atau nama) ke data.
  const meEmp = me?.viaStaff ? employees.find((e) => e.id === me.employeeId || e.name === me.name) : undefined

  const [code, setCode] = useState('')
  const [result, setResult] = useState<{ name: string; type: 'in' | 'out'; time: string } | null>(null)

  const doClock = (emp: { id: string; name: string }) => {
    const r = clock(emp as never, activeOutletId)
    setResult({ name: emp.name, type: r.type, time: r.time })
    toast.success(`${emp.name} ${r.type === 'in' ? 'masuk' : 'pulang'} ${formatTime(r.time)}`)
  }

  const press = (d: string) => setCode((c) => (c.length >= 8 ? c : c + d))
  const backspace = () => setCode((c) => c.slice(0, -1))

  const submit = () => {
    const c = code.trim()
    if (!c) return
    const matches = employees.filter((e) => e.is_active && e.code === c && e.outlet_id === activeOutletId)
    if (matches.length === 0) { toast.error('Kode tidak ditemukan / karyawan nonaktif'); setCode(''); return }
    if (matches.length > 1) { toast.error('Kode dipakai >1 karyawan — hubungi admin'); setCode(''); return }
    const emp = matches[0]
    const { type, time } = clock(emp, activeOutletId)
    setResult({ name: emp.name, type, time })
    toast.success(`${emp.name} ${type === 'in' ? 'masuk' : 'pulang'} ${formatTime(time)}`)
    setCode('')
  }

  const todayRecords = useMemo(() => {
    const t = localDay(new Date())
    return records.filter((r) => localDay(r.timestamp) === t && r.outlet_id === activeOutletId)
  }, [records, activeOutletId])

  const statusOf = (empId: string) => {
    const last = lastToday(empId)
    if (!last) return { label: 'Belum hadir', cls: 'text-muted-foreground' }
    return last.type === 'in' ? { label: `Masuk ${formatTime(last.timestamp)}`, cls: 'text-emerald-600' } : { label: `Pulang ${formatTime(last.timestamp)}`, cls: 'text-amber-600' }
  }

  const activeEmployees = employees.filter((e) => e.is_active && e.outlet_id === activeOutletId)
  const hadirCount = activeEmployees.filter((e) => { const l = lastToday(e.id); return l && l.type === 'in' }).length

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/karyawan" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1"><ArrowLeft size={13} /> Karyawan</Link>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Fingerprint size={22} /> Absensi</h1>
        <p className="text-muted-foreground text-sm mt-1">Masukkan kode karyawan untuk clock-in / clock-out · {hadirCount}/{activeEmployees.length} sedang hadir · {outletName(activeOutletId)}</p>
      </div>

      {/* Absen 1-klik untuk karyawan yang sedang login — tombol jelas sesuai status */}
      {meEmp && (() => {
        const last = lastToday(meEmp.id)
        const nextIn = !last || last.type === 'out' // langkah berikutnya: masuk?
        return (
          <Card>
            <CardContent className="p-4 flex items-center gap-3 flex-wrap">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${getAvatarColor(meEmp.name)}`}>{getInitials(meEmp.name)}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{meEmp.name}</p>
                <p className={`text-xs font-medium ${statusOf(meEmp.id).cls}`}>{statusOf(meEmp.id).label}</p>
              </div>
              {nextIn ? (
                <Button onClick={() => doClock(meEmp)} className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700 h-11 px-5 text-base">
                  <LogIn size={18} /> Absen Masuk
                </Button>
              ) : (
                <Button onClick={() => doClock(meEmp)} className="gap-2 bg-amber-600 text-white hover:bg-amber-700 h-11 px-5 text-base">
                  <LogOut size={18} /> Absen Pulang
                </Button>
              )}
            </CardContent>
          </Card>
        )
      })()}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Keypad */}
        <Card>
          <CardContent className="p-6">
            {result && (
              <div className={`mb-4 rounded-xl p-4 flex items-center gap-3 ${result.type === 'in' ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                <CheckCircle2 size={24} className={result.type === 'in' ? 'text-emerald-600' : 'text-amber-600'} />
                <div><p className="font-semibold">{result.name}</p><p className="text-sm text-muted-foreground">{result.type === 'in' ? 'Clock-in' : 'Clock-out'} · {formatTime(result.time)}</p></div>
              </div>
            )}
            <div className="h-14 rounded-xl border-2 flex items-center justify-center text-3xl font-bold tracking-[0.3em] tabular-nums mb-4 bg-muted/30">
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
          </CardContent>
        </Card>

        {/* Status hari ini */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock size={16} /> Status Hari Ini</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {activeEmployees.map((e) => {
              const st = statusOf(e.id)
              return (
                <div key={e.id} className="flex items-center gap-3 py-1.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${getAvatarColor(e.name)}`}>{getInitials(e.name)}</div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{e.name}</p><p className="text-xs text-muted-foreground">Kode: <span className="font-mono">{e.code ?? '-'}</span></p></div>
                  <span className={`text-xs font-medium ${st.cls}`}>{st.label}</span>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* Riwayat hari ini */}
      <Card>
        <CardHeader><CardTitle className="text-base">Riwayat Absensi Hari Ini</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50" style={{ borderBottom: '1px solid var(--border)' }}>
                {['Karyawan', 'Tipe', 'Waktu', 'Outlet'].map((h) => <th key={h} className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {todayRecords.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="py-2.5 px-4 font-medium">{r.employee?.name ?? employees.find((e) => e.id === r.employee_id)?.name ?? 'Karyawan'}</td>
                  <td className="py-2.5 px-4">{r.type === 'in' ? <Badge className="text-xs gap-1 bg-emerald-100 text-emerald-700 border-emerald-200"><LogIn size={10} />Masuk</Badge> : <Badge className="text-xs gap-1 bg-amber-100 text-amber-700 border-amber-200"><LogOut size={10} />Pulang</Badge>}</td>
                  <td className="py-2.5 px-4 text-muted-foreground">{formatDateTime(r.timestamp)}</td>
                  <td className="py-2.5 px-4 text-muted-foreground text-xs">{outletName(r.outlet_id)}</td>
                </tr>
              ))}
              {todayRecords.length === 0 && <tr><td colSpan={4} className="py-10 text-center text-muted-foreground">Belum ada absensi hari ini</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

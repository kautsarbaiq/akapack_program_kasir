'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BarChart3, CalendarCheck, LogIn, LogOut } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useEmployeeStore } from '@/stores/use-employee-store'
import { useAttendanceStore } from '@/stores/use-attendance-store'
import { useActiveOutletStore } from '@/stores/use-active-outlet-store'
import { useOutletStore } from '@/stores/use-outlet-store'
import { getAvatarColor, getInitials, localDay, formatTime } from '@/lib/utils'

function firstOfMonth(): string {
  const d = new Date()
  return localDay(new Date(d.getFullYear(), d.getMonth(), 1))
}

export default function AnalisisAbsensiPage() {
  const employees = useEmployeeStore((s) => s.employees)
  const records = useAttendanceStore((s) => s.records)
  const activeOutletId = useActiveOutletStore((s) => s.activeOutletId)
  const outlets = useOutletStore((s) => s.outlets)
  const outletName = outlets.find((o) => o.id === activeOutletId)?.name ?? 'Cabang'

  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(localDay(new Date()))

  const rows = useMemo(() => {
    const staff = employees.filter((e) => e.is_active && e.outlet_id === activeOutletId)
    return staff.map((e) => {
      const recs = records.filter((r) => {
        if (r.employee_id !== e.id || r.outlet_id !== activeOutletId) return false
        const d = localDay(r.timestamp)
        return d >= from && d <= to
      })
      const days = new Set(recs.filter((r) => r.type === 'in').map((r) => localDay(r.timestamp)))
      const ins = recs.filter((r) => r.type === 'in').length
      const outs = recs.filter((r) => r.type === 'out').length
      const last = recs.length ? recs.reduce((a, b) => (a.timestamp > b.timestamp ? a : b)) : undefined
      return { e, hadir: days.size, ins, outs, last }
    })
  }, [employees, records, activeOutletId, from, to])

  const totalHadir = rows.reduce((s, r) => s + r.hadir, 0)

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/karyawan/absensi" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1"><ArrowLeft size={13} /> Absensi</Link>
        <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 size={22} /> Analisis Absensi</h1>
        <p className="text-muted-foreground text-sm mt-1">Rekap kehadiran karyawan — cabang <span className="font-medium text-foreground">{outletName}</span></p>
      </div>

      <div className="flex gap-3 flex-wrap items-end">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Dari tanggal</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-44" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Sampai tanggal</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-44" />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{rows.length}</p><p className="text-xs text-muted-foreground mt-1">Karyawan</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{totalHadir}</p><p className="text-xs text-muted-foreground mt-1">Total hari hadir</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold flex items-center gap-1.5"><CalendarCheck size={20} className="text-emerald-600" />{rows.filter((r) => r.hadir > 0).length}</p><p className="text-xs text-muted-foreground mt-1">Pernah hadir</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50" style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Karyawan', 'Hari Hadir', 'Clock-in', 'Clock-out', 'Aktivitas Terakhir'].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ e, hadir, ins, outs, last }) => (
                  <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover:bg-muted/30">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${getAvatarColor(e.name)}`}>{getInitials(e.name)}</div>
                        <div><p className="font-medium">{e.name}</p><p className="text-xs text-muted-foreground font-mono">Kode: {e.code ?? '-'}</p></div>
                      </div>
                    </td>
                    <td className="py-3 px-4"><span className="font-bold">{hadir}</span> <span className="text-xs text-muted-foreground">hari</span></td>
                    <td className="py-3 px-4 text-emerald-600"><span className="inline-flex items-center gap-1"><LogIn size={12} />{ins}</span></td>
                    <td className="py-3 px-4 text-amber-600"><span className="inline-flex items-center gap-1"><LogOut size={12} />{outs}</span></td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">{last ? `${localDay(last.timestamp)} · ${formatTime(last.timestamp)} (${last.type === 'in' ? 'masuk' : 'pulang'})` : '—'}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">Belum ada karyawan di cabang ini. Tetapkan cabang karyawan di menu Karyawan.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

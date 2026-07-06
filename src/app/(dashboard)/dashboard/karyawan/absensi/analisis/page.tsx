'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BarChart3, CalendarCheck, Clock, AlertTriangle, Timer } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useEmployeeStore } from '@/stores/use-employee-store'
import { useAttendanceStore } from '@/stores/use-attendance-store'
import { useActiveOutletStore } from '@/stores/use-active-outlet-store'
import { useOutletStore } from '@/stores/use-outlet-store'
import { useCurrentUserStore, useRole } from '@/stores/use-current-user-store'
import { getAvatarColor, getInitials, localDay, formatTime } from '@/lib/utils'

function firstOfMonth(): string {
  const d = new Date()
  return localDay(new Date(d.getFullYear(), d.getMonth(), 1))
}
const mmToHHMM = (m: number) => { const t = Math.round(m); return `${String(Math.floor(t / 60)).padStart(2, '0')}.${String(t % 60).padStart(2, '0')}` } // bulatkan total dulu (539.5 → 09.00, bukan 08.60)
const fmtHours = (h: number) => (h > 0 ? `${h.toFixed(1)} jam` : '—')

export default function AnalisisAbsensiPage() {
  const employees = useEmployeeStore((s) => s.employees)
  const records = useAttendanceStore((s) => s.records)
  const activeOutletId = useActiveOutletStore((s) => s.activeOutletId)
  const outlets = useOutletStore((s) => s.outlets)
  const outletName = outlets.find((o) => o.id === activeOutletId)?.name ?? 'Cabang'

  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(localDay(new Date()))
  const [stdIn, setStdIn] = useState('08:00') // jam masuk standar → hitung telat

  const me = useCurrentUserStore((s) => s.user)
  const { isCashier } = useRole() // kasir hanya lihat absensi sendiri

  const stdMinutes = useMemo(() => {
    const [h, m] = stdIn.split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }, [stdIn])

  const rows = useMemo(() => {
    const staff = employees.filter((e) => e.is_active && e.outlet_id === activeOutletId
      && (!isCashier || e.id === me?.employeeId)) // kasir: hanya baris dirinya
    return staff.map((e) => {
      const recs = records.filter((r) => {
        if (r.employee_id !== e.id || r.outlet_id !== activeOutletId) return false
        const d = localDay(r.timestamp)
        return d >= from && d <= to
      })
      // Pasangkan KRONOLOGIS: tiap "masuk" ditutup "pulang" berikutnya — shift lembur yang
      // lewat tengah malam tetap terhitung jam kerjanya (bukan 0 + salah "tak lengkap").
      const sorted = [...recs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      const firstInByDay = new Map<string, number>() // hari → menit jam masuk PERTAMA (utk telat & rata2)
      let openIn: number | null = null
      let workMs = 0, incompleteDays = 0
      for (const r of sorted) {
        const t = new Date(r.timestamp).getTime()
        if (r.type === 'in') {
          if (openIn !== null) incompleteDays++ // masuk sebelumnya tak pernah ditutup
          openIn = t
          const day = localDay(r.timestamp)
          if (!firstInByDay.has(day)) {
            const d = new Date(t)
            firstInByDay.set(day, d.getHours() * 60 + d.getMinutes())
          }
        } else if (openIn !== null && t > openIn) {
          workMs += t - openIn
          openIn = null
        }
      }
      if (openIn !== null) incompleteDays++ // masuk terakhir belum pulang (termasuk shift yang masih jalan)
      let lateDays = 0, inMinSum = 0
      firstInByDay.forEach((min) => { inMinSum += min; if (min > stdMinutes) lateDays++ })
      const last = sorted.length ? sorted[sorted.length - 1] : undefined
      return {
        e, hadir: firstInByDay.size, telat: lateDays, incomplete: incompleteDays,
        jamKerja: workMs / 3_600_000,
        avgIn: firstInByDay.size ? mmToHHMM(inMinSum / firstInByDay.size) : '—',
        last,
      }
    })
  }, [employees, records, activeOutletId, from, to, isCashier, me, stdMinutes])

  const totalHadir = rows.reduce((s, r) => s + r.hadir, 0)
  const totalJam = rows.reduce((s, r) => s + r.jamKerja, 0)
  const totalTelat = rows.reduce((s, r) => s + r.telat, 0)
  const chartData = rows.filter((r) => r.hadir > 0).map((r) => ({ name: r.e.name.split(' ')[0], Hadir: r.hadir, Telat: r.telat }))

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/karyawan/absensi" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1"><ArrowLeft size={13} /> Absensi</Link>
        <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 size={22} /> Analisis Absensi</h1>
        <p className="text-muted-foreground text-sm mt-1">Rekap kehadiran, jam kerja & keterlambatan — cabang <span className="font-medium text-foreground">{outletName}</span></p>
      </div>

      <div className="flex gap-3 flex-wrap items-end">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Dari tanggal</label>
          <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-9 w-44" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Sampai tanggal</label>
          <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="h-9 w-44" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Jam masuk standar (utk telat)</label>
          <Input type="time" value={stdIn} onChange={(e) => setStdIn(e.target.value || '08:00')} className="h-9 w-36" />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{rows.length}</p><p className="text-xs text-muted-foreground mt-1">Karyawan</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold flex items-center gap-1.5"><CalendarCheck size={18} className="text-emerald-600" />{totalHadir}</p><p className="text-xs text-muted-foreground mt-1">Total hari hadir</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold flex items-center gap-1.5"><Timer size={18} className="text-blue-600" />{totalJam.toFixed(1)}</p><p className="text-xs text-muted-foreground mt-1">Total jam kerja</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold flex items-center gap-1.5"><AlertTriangle size={18} className="text-amber-600" />{totalTelat}</p><p className="text-xs text-muted-foreground mt-1">Total telat (hari)</p></CardContent></Card>
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 size={16} /> Kehadiran per Karyawan</CardTitle></CardHeader>
          <CardContent>
            <div style={{ width: '100%', height: Math.max(200, chartData.length * 34) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="Hadir" fill="oklch(0.65 0.18 160)" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="Telat" fill="oklch(0.7 0.18 60)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50" style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Karyawan', 'Hari Hadir', 'Jam Kerja', 'Rata2 Masuk', 'Telat', 'Tak Lengkap', 'Aktivitas Terakhir'].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ e, hadir, jamKerja, avgIn, telat, incomplete, last }) => (
                  <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover:bg-muted/30">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${getAvatarColor(e.name)}`}>{getInitials(e.name)}</div>
                        <div><p className="font-medium">{e.name}</p><p className="text-xs text-muted-foreground font-mono">Kode: {e.code ?? '-'}</p></div>
                      </div>
                    </td>
                    <td className="py-3 px-4"><span className="font-bold">{hadir}</span> <span className="text-xs text-muted-foreground">hari</span></td>
                    <td className="py-3 px-4">{fmtHours(jamKerja)}</td>
                    <td className="py-3 px-4 inline-flex items-center gap-1 text-muted-foreground"><Clock size={12} />{avgIn}</td>
                    <td className="py-3 px-4">{telat > 0 ? <span className="text-amber-600 font-semibold">{telat} hari</span> : <span className="text-muted-foreground">0</span>}</td>
                    <td className="py-3 px-4">{incomplete > 0 ? <span className="text-destructive">{incomplete} hari</span> : <span className="text-muted-foreground">0</span>}</td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">{last ? `${localDay(last.timestamp)} · ${formatTime(last.timestamp)} (${last.type === 'in' ? 'masuk' : 'pulang'})` : '—'}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">Belum ada karyawan di cabang ini. Tetapkan cabang karyawan di menu Karyawan.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-3 text-xs text-muted-foreground border-t">
            <b>Telat</b> = jam masuk pertama lewat {stdIn}. <b>Tak Lengkap</b> = ada absen masuk tapi tak absen pulang. <b>Jam Kerja</b> = selisih masuk pertama → pulang terakhir per hari.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

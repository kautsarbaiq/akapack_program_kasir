'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BarChart3, CalendarCheck, Clock, AlertTriangle, Timer } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
// Durasi gaya Olsera: "9 jam 42 menit" / "42 menit" / "—".
const fmtDur = (ms: number) => {
  if (ms <= 0) return '—'
  const totalMin = Math.round(ms / 60000)
  const h = Math.floor(totalMin / 60), m = totalMin % 60
  if (h > 0 && m > 0) return `${h} jam ${m} menit`
  if (h > 0) return `${h} jam`
  return `${m} menit`
}

export default function AnalisisAbsensiPage() {
  const employees = useEmployeeStore((s) => s.employees)
  const records = useAttendanceStore((s) => s.records)
  const activeOutletId = useActiveOutletStore((s) => s.activeOutletId)
  const outlets = useOutletStore((s) => s.outlets)
  const outletName = outlets.find((o) => o.id === activeOutletId)?.name ?? 'Cabang'

  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(localDay(new Date()))
  const [stdIn, setStdIn] = useState('08:00') // jam masuk standar → hitung telat
  const [view, setView] = useState<'ringkasan' | 'harian'>('ringkasan') // ringkasan (rekap) / harian (per tanggal gaya Olsera)

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

  // Rekap HARIAN per (tanggal, karyawan) — format Olsera: Tanggal | Pegawai | Datang | Pulang | Durasi.
  const perDate = useMemo(() => {
    const staff = employees.filter((e) => e.is_active && e.outlet_id === activeOutletId
      && (!isCashier || e.id === me?.employeeId))
    const out: { key: string; date: string; name: string; datang: string; pulang: string; durasi: string; complete: boolean }[] = []
    for (const e of staff) {
      const byDay = new Map<string, { ts: number; type: 'in' | 'out' }[]>()
      for (const r of records) {
        if (r.employee_id !== e.id || r.outlet_id !== activeOutletId) continue
        const d = localDay(r.timestamp)
        if (d < from || d > to) continue
        const arr = byDay.get(d) ?? []
        arr.push({ ts: new Date(r.timestamp).getTime(), type: r.type })
        byDay.set(d, arr)
      }
      byDay.forEach((arr, day) => {
        arr.sort((a, b) => a.ts - b.ts)
        const ins = arr.filter((x) => x.type === 'in')
        const outs = arr.filter((x) => x.type === 'out')
        const firstIn = ins.length ? ins[0].ts : arr[0]?.ts ?? null
        const lastOut = outs.length ? outs[outs.length - 1].ts : null
        // Durasi = total jam kerja (pasangkan masuk→pulang kronologis; abaikan jeda istirahat).
        let workMs = 0, openIn: number | null = null
        for (const x of arr) {
          if (x.type === 'in') openIn = x.ts
          else if (openIn !== null && x.ts > openIn) { workMs += x.ts - openIn; openIn = null }
        }
        out.push({
          key: `${e.id}-${day}`, date: day, name: e.name,
          datang: firstIn !== null ? formatTime(new Date(firstIn)) : '—',
          pulang: lastOut !== null ? formatTime(new Date(lastOut)) : '—',
          // complete=false bila masih ada sesi masuk yang belum ditutup (mis. masuk lagi tanpa pulang).
          durasi: fmtDur(workMs), complete: lastOut !== null && openIn === null,
        })
      })
    }
    out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.name.localeCompare(b.name)))
    return out
  }, [employees, records, activeOutletId, from, to, isCashier, me])

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

      <div className="flex gap-2">
        <Button size="sm" variant={view === 'ringkasan' ? 'default' : 'outline'} className={`text-xs ${view === 'ringkasan' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}`} onClick={() => setView('ringkasan')}>Ringkasan</Button>
        <Button size="sm" variant={view === 'harian' ? 'default' : 'outline'} className={`text-xs ${view === 'harian' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}`} onClick={() => setView('harian')}>Per Tanggal</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{rows.length}</p><p className="text-xs text-muted-foreground mt-1">Karyawan</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold flex items-center gap-1.5"><CalendarCheck size={18} className="text-emerald-600" />{totalHadir}</p><p className="text-xs text-muted-foreground mt-1">Total hari hadir</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold flex items-center gap-1.5"><Timer size={18} className="text-blue-600" />{totalJam.toFixed(1)}</p><p className="text-xs text-muted-foreground mt-1">Total jam kerja</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold flex items-center gap-1.5"><AlertTriangle size={18} className="text-amber-600" />{totalTelat}</p><p className="text-xs text-muted-foreground mt-1">Total telat (hari)</p></CardContent></Card>
      </div>

      {view === 'ringkasan' && (<>
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
      </>)}

      {/* Rekap HARIAN (format Olsera): satu baris per tanggal per karyawan */}
      {view === 'harian' && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50" style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Tanggal', 'Pegawai', 'Datang', 'Pulang', 'Durasi'].map((h) => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {perDate.map((r) => (
                    <tr key={r.key} style={{ borderBottom: '1px solid var(--border)' }} className="hover:bg-muted/30">
                      <td className="py-2.5 px-4 text-muted-foreground whitespace-nowrap">{r.date}</td>
                      <td className="py-2.5 px-4 font-medium">{r.name}</td>
                      <td className="py-2.5 px-4 tabular-nums">{r.datang}</td>
                      <td className="py-2.5 px-4 tabular-nums">{r.complete ? r.pulang : <span className="text-amber-600">belum pulang</span>}</td>
                      <td className="py-2.5 px-4">{r.durasi}</td>
                    </tr>
                  ))}
                  {perDate.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">Tidak ada absensi pada rentang ini.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="px-4 py-3 text-xs text-muted-foreground border-t">
              <b>Datang</b> = absen masuk pertama · <b>Pulang</b> = absen pulang terakhir · <b>Durasi</b> = total jam kerja (jeda istirahat tak dihitung). Shift lintas tengah malam tercatat terpisah per tanggal.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

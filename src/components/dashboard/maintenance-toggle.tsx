'use client'

import { useState, useEffect } from 'react'
import { Wrench, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { getSupabaseBrowser } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { toast } from 'sonner'

const DEFAULT_MSG = 'Website sedang dalam perbaikan & peningkatan. Mohon kembali beberapa saat lagi — terima kasih atas pengertiannya.'

// Toggle MODE MAINTENANCE (owner). Menulis flag ke app_config; middleware membacanya & menutup web
// untuk semua pengunjung KECUALI owner. Berlaku ~15 detik (ada cache di middleware).
export function MaintenanceToggle() {
  const [on, setOn] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured()) { setLoading(false); return }
    void (async () => {
      try {
        const { data } = await getSupabaseBrowser()
          .from('app_config').select('maintenance_mode, maintenance_message').eq('id', 1).single()
        if (data) { setOn(!!data.maintenance_mode); setMessage(data.maintenance_message || '') }
      } catch { /* tabel belum dibuat → biarkan default */ }
      setLoading(false)
    })()
  }, [])

  const persist = async (nextOn: boolean) => {
    if (!isSupabaseConfigured()) { toast.error('Supabase belum siap.'); return }
    setBusy(true)
    const prev = on
    setOn(nextOn) // optimistic
    try {
      const { error } = await getSupabaseBrowser().from('app_config').upsert({
        id: 1, maintenance_mode: nextOn, maintenance_message: message.trim() || null, updated_at: new Date().toISOString(),
      })
      if (error) throw error
      toast.success(nextOn
        ? 'Mode maintenance DINYALAKAN — pengunjung melihat halaman perawatan (berlaku ~15 detik).'
        : 'Mode maintenance DIMATIKAN — web kembali normal.')
    } catch {
      setOn(prev) // revert
      toast.error('Gagal mengubah. Pastikan migrasi app_config sudah dijalankan.')
    }
    setBusy(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Wrench size={18} /> Mode Maintenance</CardTitle>
        <CardDescription>
          Saat aktif, semua pengunjung melihat halaman &quot;Sedang Maintenance&quot;. <b>Kamu (owner) tetap bisa masuk</b> untuk mengelola.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-xl border p-4">
          <div>
            <p className="font-medium">{on ? '🔧 Web sedang ditutup (maintenance)' : '🟢 Web normal & bisa diakses'}</p>
            <p className="text-sm text-muted-foreground">{on ? 'Pengunjung diarahkan ke halaman perawatan.' : 'Nyalakan untuk menutup web sementara.'}</p>
          </div>
          {loading
            ? <Loader2 size={18} className="animate-spin text-muted-foreground" />
            : <Switch checked={on} disabled={busy} onCheckedChange={persist} />}
        </div>

        <div className="space-y-2">
          <Label>Pesan yang ditampilkan ke pengunjung (opsional)</Label>
          <textarea
            value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
            placeholder={DEFAULT_MSG}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          <div className="flex justify-end">
            <Button variant="outline" size="sm" disabled={busy} onClick={() => persist(on)}>
              {busy ? <Loader2 size={15} className="animate-spin mr-1.5" /> : null} Simpan Pesan
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

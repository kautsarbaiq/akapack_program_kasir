'use client'

import { useState } from 'react'
import { Plus, Tag, Percent, Banknote, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { usePromotionStore } from '@/stores/use-promotion-store'
import { PromotionFormDialog } from '@/components/dashboard/promotion-form-dialog'
import { formatRupiah, formatDate } from '@/lib/utils'
import type { Promotion } from '@/types'
import { toast } from 'sonner'

const TYPE_LABELS: Record<string, string> = {
  percentage: 'Persen %',
  fixed: 'Nominal Rp',
  bogo: 'Buy X Get Y',
  bundle: 'Bundle',
}

export default function PromosiPage() {
  const promos = usePromotionStore((s) => s.promotions)
  const toggleActive = usePromotionStore((s) => s.toggleActive)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Promotion | null>(null)

  const active = promos.filter(p => p.is_active).length
  const totalUses = promos.reduce((s, p) => s + p.used_count, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Promosi & Diskon</h1>
          <p className="text-muted-foreground text-sm mt-1">Kelola program promosi dan voucher toko</p>
        </div>
        <Button size="sm" className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => { setEditTarget(null); setFormOpen(true) }}>
          <Plus size={15} /> Buat Promosi
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Promosi', value: promos.length },
          { label: 'Aktif Sekarang', value: active },
          { label: 'Total Penggunaan', value: totalUses },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Promo cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {promos.map((promo) => (
          <Card key={promo.id} className={`overflow-hidden ${!promo.is_active ? 'opacity-70' : ''}`}>
            <div className="h-1.5" style={{ background: promo.is_active ? 'oklch(0.55 0.22 264)' : 'oklch(0.7 0.01 250)' }} />
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: promo.is_active ? 'oklch(0.55 0.22 264 / 0.1)' : 'oklch(0.9 0.01 250)' }}>
                  {promo.type === 'percentage' ? <Percent size={18} style={{ color: 'oklch(0.55 0.22 264)' }} /> :
                    <Banknote size={18} style={{ color: 'oklch(0.55 0.22 264)' }} />}
                </div>
                <Badge variant="outline" className={promo.is_active
                  ? 'border-emerald-400 text-emerald-600 text-xs gap-1'
                  : 'text-xs gap-1'}>
                  {promo.is_active ? <><CheckCircle2 size={10} />Aktif</> : <><XCircle size={10} />Tidak Aktif</>}
                </Badge>
              </div>

              <div>
                <h3 className="font-semibold">{promo.name}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {TYPE_LABELS[promo.type]} ·{' '}
                  <span className="font-medium text-foreground">
                    {promo.type === 'percentage' ? `${promo.value}%` : formatRupiah(promo.value)} OFF
                  </span>
                </p>
                {promo.code && (
                  <span className="inline-block mt-1.5 px-2 py-0.5 rounded bg-muted font-mono text-xs font-semibold">
                    {promo.code}
                  </span>
                )}
              </div>

              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Clock size={11} />
                  {formatDate(promo.starts_at)} — {formatDate(promo.ends_at)}
                </div>
                <div className="flex items-center gap-1.5">
                  <Tag size={11} />
                  Digunakan: {promo.used_count}{promo.max_uses ? `/${promo.max_uses}` : ''} kali
                </div>
              </div>

              {promo.max_uses && (
                <div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{
                      width: `${Math.min(100, (promo.used_count / promo.max_uses) * 100)}%`,
                      background: 'oklch(0.55 0.22 264)'
                    }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{promo.used_count}/{promo.max_uses} penggunaan</p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="flex-1 h-8 text-xs"
                  onClick={() => { setEditTarget(promo); setFormOpen(true) }}>Edit</Button>
                <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs"
                  onClick={() => { toggleActive(promo.id); toast.success(promo.is_active ? `Promosi "${promo.name}" dinonaktifkan` : `Promosi "${promo.name}" diaktifkan`) }}>
                  {promo.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Add new card */}
        <Card className="border-dashed cursor-pointer hover:border-primary hover:bg-primary/5 transition-all duration-200"
          onClick={() => { setEditTarget(null); setFormOpen(true) }}>
          <CardContent className="p-5 flex flex-col items-center justify-center h-full min-h-[220px] gap-2">
            <div className="w-10 h-10 rounded-full border-2 border-dashed border-muted-foreground/50 flex items-center justify-center">
              <Plus size={20} className="text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">Buat Promosi Baru</p>
          </CardContent>
        </Card>
      </div>

      <PromotionFormDialog open={formOpen} onOpenChange={setFormOpen} promotion={editTarget} />
    </div>
  )
}

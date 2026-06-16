'use client'

import Link from 'next/link'
import { BookOpen, ScrollText, Wallet, Scale, TrendingUp, ArrowRight, CheckCircle2, AlertTriangle, Waves, HandCoins, Boxes, Lock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useBooks } from '@/lib/use-books'
import { formatRupiah } from '@/lib/utils'

const LINKS = [
  { href: '/dashboard/akuntansi/akun', title: 'Daftar Akun', desc: 'Chart of Accounts', icon: BookOpen },
  { href: '/dashboard/akuntansi/jurnal', title: 'Jurnal', desc: 'Jurnal umum & manual', icon: ScrollText },
  { href: '/dashboard/akuntansi/buku-besar', title: 'Buku Besar', desc: 'Mutasi per akun', icon: Wallet },
  { href: '/dashboard/akuntansi/laba-rugi', title: 'Laba Rugi', desc: 'Pendapatan − beban', icon: TrendingUp },
  { href: '/dashboard/akuntansi/neraca', title: 'Neraca', desc: 'Aset = Kewajiban + Ekuitas', icon: Scale },
  { href: '/dashboard/akuntansi/arus-kas', title: 'Arus Kas', desc: 'Kas masuk & keluar', icon: Waves },
  { href: '/dashboard/akuntansi/piutang-hutang', title: 'Piutang & Hutang', desc: 'Umur & saldo', icon: HandCoins },
  { href: '/dashboard/akuntansi/aset', title: 'Aset & Penyusutan', desc: 'Register & depresiasi', icon: Boxes },
  { href: '/dashboard/akuntansi/tutup-buku', title: 'Tutup Buku', desc: 'Kunci periode', icon: Lock },
]

function Kpi({ title, value, accent }: { title: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className={`text-2xl font-bold ${accent ? 'text-emerald-600' : ''}`}>{value}</p>
        <p className="text-sm text-muted-foreground mt-1">{title}</p>
      </CardContent>
    </Card>
  )
}

export default function AkuntansiPage() {
  const { balanceSheet, profitLoss } = useBooks()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Akuntansi</h1>
        <p className="text-muted-foreground text-sm mt-1">Pembukuan otomatis dari transaksi POS & online — double-entry</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi title="Total Aset" value={formatRupiah(balanceSheet.totalAssets)} />
        <Kpi title="Total Kewajiban" value={formatRupiah(balanceSheet.totalLiabilities)} />
        <Kpi title="Total Ekuitas" value={formatRupiah(balanceSheet.totalEquity)} />
        <Kpi title="Laba Bersih (berjalan)" value={formatRupiah(profitLoss.netProfit)} accent />
      </div>

      <Card>
        <CardContent className="p-4 flex items-center gap-3 text-sm">
          {balanceSheet.balanced ? (
            <><CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              <span>Neraca <strong>seimbang</strong> — Aset {formatRupiah(balanceSheet.totalAssets)} = Kewajiban + Ekuitas {formatRupiah(balanceSheet.totalLiabilities + balanceSheet.totalEquity)}.</span></>
          ) : (
            <><AlertTriangle size={18} className="text-amber-500 shrink-0" />
              <span>Neraca <strong>belum seimbang</strong> (selisih {formatRupiah(Math.abs(balanceSheet.totalAssets - (balanceSheet.totalLiabilities + balanceSheet.totalEquity)))}). Cek saldo awal akun.</span></>
          )}
        </CardContent>
      </Card>

      <div>
        <CardHeader className="px-0">
          <CardTitle className="text-base">Modul Akuntansi</CardTitle>
        </CardHeader>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {LINKS.map((l) => {
            const Icon = l.icon
            return (
              <Link key={l.href} href={l.href}>
                <Card className="hover:border-primary/40 transition-colors h-full">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon size={18} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{l.title}</p>
                      <p className="text-xs text-muted-foreground">{l.desc}</p>
                    </div>
                    <ArrowRight size={15} className="text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

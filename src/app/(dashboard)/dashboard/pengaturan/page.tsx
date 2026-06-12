'use client'

import { useState } from 'react'
import { Save, Store, Percent, Receipt, Bell } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

export default function PengaturanPage() {
  const [taxEnabled, setTaxEnabled] = useState(false)
  const [taxRate, setTaxRate] = useState(11)
  const [serviceEnabled, setServiceEnabled] = useState(false)
  const [serviceRate, setServiceRate] = useState(5)
  const [showLogo, setShowLogo] = useState(true)
  const [showAddress, setShowAddress] = useState(true)
  const [emailAlert, setEmailAlert] = useState(true)
  const [dailyReport, setDailyReport] = useState(false)

  const handleSave = () => toast.success('Pengaturan berhasil disimpan!')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pengaturan</h1>
        <p className="text-muted-foreground text-sm mt-1">Konfigurasi toko dan sistem AKAPACK Anda</p>
      </div>

      <Tabs defaultValue="toko">
        <TabsList className="mb-6">
          <TabsTrigger value="toko" className="gap-1.5"><Store size={14} /> Profil Toko</TabsTrigger>
          <TabsTrigger value="pajak" className="gap-1.5"><Percent size={14} /> Pajak & Biaya</TabsTrigger>
          <TabsTrigger value="struk" className="gap-1.5"><Receipt size={14} /> Struk</TabsTrigger>
          <TabsTrigger value="notif" className="gap-1.5"><Bell size={14} /> Notifikasi</TabsTrigger>
        </TabsList>

        {/* Profil Toko */}
        <TabsContent value="toko">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informasi Toko</CardTitle>
              <CardDescription>Data toko yang akan muncul di struk dan laporan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-5 pb-5" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center text-3xl">🏪</div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Logo Toko</p>
                  <Button variant="outline" size="sm">Upload Logo</Button>
                  <p className="text-xs text-muted-foreground">PNG, JPG maks. 2MB</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nama Toko *</Label>
                  <Input defaultValue="Toko AKAPACK" />
                </div>
                <div className="space-y-2">
                  <Label>Telepon</Label>
                  <Input defaultValue="081234567890" />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Alamat Lengkap</Label>
                  <Input defaultValue="Jl. Contoh No. 123, Jakarta" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" defaultValue="toko@akapack.com" />
                </div>
                <div className="space-y-2">
                  <Label>Website (opsional)</Label>
                  <Input placeholder="www.tokoanda.com" />
                </div>
              </div>
              <Button onClick={handleSave} className="gap-2" style={{ background: 'oklch(0.55 0.22 264)' }}>
                <Save size={15} /> Simpan Perubahan
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pajak */}
        <TabsContent value="pajak">
          <div className="space-y-4">
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">PPN (Pajak Pertambahan Nilai)</p>
                    <p className="text-sm text-muted-foreground">Tambahkan PPN ke total transaksi</p>
                  </div>
                  <Switch checked={taxEnabled} onCheckedChange={setTaxEnabled} />
                </div>
                {taxEnabled && (
                  <>
                    <Separator />
                    <div className="flex items-center gap-3">
                      <Label>Persentase PPN</Label>
                      <div className="flex items-center gap-2">
                        <Input type="number" className="w-20 h-9" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    </div>
                    <div className="rounded-lg p-3 bg-muted/50 text-sm">
                      Contoh: Transaksi Rp 100.000 + PPN {taxRate}% = <strong>Rp {(100000 * (1 + taxRate / 100)).toLocaleString('id-ID')}</strong>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">Service Charge</p>
                    <p className="text-sm text-muted-foreground">Biaya layanan tambahan</p>
                  </div>
                  <Switch checked={serviceEnabled} onCheckedChange={setServiceEnabled} />
                </div>
                {serviceEnabled && (
                  <>
                    <Separator />
                    <div className="flex items-center gap-3">
                      <Label>Persentase</Label>
                      <div className="flex items-center gap-2">
                        <Input type="number" className="w-20 h-9" value={serviceRate} onChange={(e) => setServiceRate(Number(e.target.value))} />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
            <Button onClick={handleSave} className="gap-2" style={{ background: 'oklch(0.55 0.22 264)' }}>
              <Save size={15} /> Simpan
            </Button>
          </div>
        </TabsContent>

        {/* Struk */}
        <TabsContent value="struk">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Konfigurasi Struk</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: 'Tampilkan Logo', desc: 'Logo toko di bagian atas struk', value: showLogo, setter: setShowLogo },
                  { label: 'Tampilkan Alamat', desc: 'Alamat lengkap di struk', value: showAddress, setter: setShowAddress },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch checked={item.value} onCheckedChange={item.setter} />
                  </div>
                ))}
                <div className="space-y-2">
                  <Label>Pesan Bawah Struk</Label>
                  <Input defaultValue="Terima kasih telah berbelanja!" />
                </div>
                <Button onClick={handleSave} className="gap-2 w-full" style={{ background: 'oklch(0.55 0.22 264)' }}>
                  <Save size={15} /> Simpan
                </Button>
              </CardContent>
            </Card>

            {/* Struk Preview */}
            <Card>
              <CardHeader><CardTitle className="text-base">Preview Struk</CardTitle></CardHeader>
              <CardContent>
                <div className="bg-white border rounded-xl p-5 font-mono text-xs space-y-1 max-w-[220px] mx-auto shadow-sm">
                  {showLogo && <div className="text-center font-bold text-sm mb-2">🏪 AKAPACK</div>}
                  {showAddress && <div className="text-center text-gray-500 mb-2">Jl. Contoh No. 123</div>}
                  <div className="border-t border-dashed my-2" />
                  <div className="flex justify-between"><span>Kaos Polos x2</span><span>170.000</span></div>
                  <div className="flex justify-between"><span>Celana Jeans x1</span><span>250.000</span></div>
                  <div className="border-t border-dashed my-2" />
                  <div className="flex justify-between font-bold"><span>TOTAL</span><span>420.000</span></div>
                  <div className="flex justify-between"><span>Tunai</span><span>500.000</span></div>
                  <div className="flex justify-between"><span>Kembalian</span><span>80.000</span></div>
                  <div className="border-t border-dashed my-2" />
                  <div className="text-center text-gray-500">Terima kasih!</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Notifikasi */}
        <TabsContent value="notif">
          <Card>
            <CardHeader><CardTitle className="text-base">Pengaturan Notifikasi</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: 'Alert Stok Menipis', desc: 'Kirim email saat stok produk di bawah batas minimum', value: emailAlert, setter: setEmailAlert },
                { label: 'Laporan Harian', desc: 'Kirim ringkasan penjualan setiap akhir hari', value: dailyReport, setter: setDailyReport },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch checked={item.value} onCheckedChange={item.setter} />
                </div>
              ))}
              <div className="space-y-2 pt-2">
                <Label>Email Penerima Notifikasi</Label>
                <Input type="email" defaultValue="andi@akapack.com" />
              </div>
              <Button onClick={handleSave} className="gap-2" style={{ background: 'oklch(0.55 0.22 264)' }}>
                <Save size={15} /> Simpan
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

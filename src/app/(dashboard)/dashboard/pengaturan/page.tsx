'use client'

import { useState, useEffect } from 'react'
import { Save, Store, Percent, Receipt, Bell, Globe } from 'lucide-react'
import { useSettingsStore } from '@/stores/use-settings-store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { formatRupiah } from '@/lib/utils'
import { toast } from 'sonner'

export default function PengaturanPage() {
  const storedTaxRate = useSettingsStore((s) => s.taxRate)
  const storedServiceRate = useSettingsStore((s) => s.serviceRate)
  const storedStoreName = useSettingsStore((s) => s.storeName)
  const storedStoreEmail = useSettingsStore((s) => s.storeEmail)
  const storedReceiptFooter = useSettingsStore((s) => s.receiptFooter)
  const storedStorePhone = useSettingsStore((s) => s.storePhone)
  const storedStoreAddress = useSettingsStore((s) => s.storeAddress)
  const storedWaNumber = useSettingsStore((s) => s.waNumber)
  const storedBankInfo = useSettingsStore((s) => s.bankInfo)
  const storedShippingFlat = useSettingsStore((s) => s.shippingFlat)
  const saveSettings = useSettingsStore((s) => s.save)
  const saveOnline = useSettingsStore((s) => s.saveOnline)

  const [taxEnabled, setTaxEnabled] = useState(false)
  const [taxRate, setTaxRate] = useState(11)
  const [serviceEnabled, setServiceEnabled] = useState(false)
  const [serviceRate, setServiceRate] = useState(5)
  const [showLogo, setShowLogo] = useState(true)
  const [showAddress, setShowAddress] = useState(true)
  const [emailAlert, setEmailAlert] = useState(true)
  const [dailyReport, setDailyReport] = useState(false)

  // Profil toko
  const [storeName, setStoreName] = useState('')
  const [storeEmail, setStoreEmail] = useState('')
  const [storePhone, setStorePhone] = useState('')
  const [storeAddress, setStoreAddress] = useState('')
  const [receiptFooter, setReceiptFooter] = useState('')
  // Toko online
  const [waNumber, setWaNumber] = useState('')
  const [bankInfo, setBankInfo] = useState('')
  const [shippingFlat, setShippingFlat] = useState(10000)

  // Sinkronkan form dari settings store saat data termuat
  useEffect(() => {
    setTaxEnabled(storedTaxRate > 0)
    if (storedTaxRate > 0) setTaxRate(storedTaxRate)
    setServiceEnabled(storedServiceRate > 0)
    if (storedServiceRate > 0) setServiceRate(storedServiceRate)
  }, [storedTaxRate, storedServiceRate])

  useEffect(() => {
    setStoreName(storedStoreName)
    setStoreEmail(storedStoreEmail)
    setReceiptFooter(storedReceiptFooter)
    setStorePhone(storedStorePhone)
    setStoreAddress(storedStoreAddress)
    setWaNumber(storedWaNumber)
    setBankInfo(storedBankInfo)
    setShippingFlat(storedShippingFlat)
  }, [storedStoreName, storedStoreEmail, storedReceiptFooter, storedStorePhone, storedStoreAddress, storedWaNumber, storedBankInfo, storedShippingFlat])

  const handleSaveProfile = () => {
    saveSettings({ storeName: storeName.trim() || 'AKAPACK', storeEmail: storeEmail.trim() })
    saveOnline({ storePhone: storePhone.trim(), storeAddress: storeAddress.trim() })
    toast.success('Profil toko disimpan!')
  }

  const handleSaveReceipt = () => {
    saveSettings({ receiptFooter: receiptFooter.trim() })
    toast.success('Pengaturan struk disimpan!')
  }

  const handleSaveOnline = () => {
    saveOnline({ waNumber: waNumber.trim(), bankInfo: bankInfo.trim(), shippingFlat: Number(shippingFlat) || 0 })
    toast.success('Pengaturan toko online disimpan!')
  }

  const handleSave = () => toast.success('Pengaturan berhasil disimpan!')

  const handleSaveTax = () => {
    saveSettings({
      taxRate: taxEnabled ? taxRate : 0,
      serviceRate: serviceEnabled ? serviceRate : 0,
    })
    toast.success('Pengaturan pajak & biaya disimpan! Langsung berlaku di kasir.')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pengaturan</h1>
        <p className="text-muted-foreground text-sm mt-1">Konfigurasi toko dan sistem AKAPACK Anda</p>
      </div>

      <Tabs defaultValue="toko">
        <TabsList className="mb-6">
          <TabsTrigger value="toko" className="gap-1.5"><Store size={14} /> Profil Toko</TabsTrigger>
          <TabsTrigger value="online" className="gap-1.5"><Globe size={14} /> Toko Online</TabsTrigger>
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
                  <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Toko AKAPACK" />
                </div>
                <div className="space-y-2">
                  <Label>Telepon</Label>
                  <Input value={storePhone} onChange={(e) => setStorePhone(e.target.value)} placeholder="081234567890" />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Alamat Lengkap</Label>
                  <Input value={storeAddress} onChange={(e) => setStoreAddress(e.target.value)} placeholder="Jl. Contoh No. 123, Jakarta" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={storeEmail} onChange={(e) => setStoreEmail(e.target.value)} placeholder="email@toko.com" />
                </div>
                <div className="space-y-2">
                  <Label>Website (opsional)</Label>
                  <Input placeholder="www.tokoanda.com" />
                </div>
              </div>
              <Button onClick={handleSaveProfile} className="gap-2" style={{ background: 'oklch(0.55 0.22 264)' }}>
                <Save size={15} /> Simpan Perubahan
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Toko Online */}
        <TabsContent value="online">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pengaturan Toko Online</CardTitle>
              <CardDescription>Konfigurasi halaman belanja online (/toko) — WhatsApp, pembayaran, & ongkir</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Nomor WhatsApp Toko</Label>
                <Input value={waNumber} onChange={(e) => setWaNumber(e.target.value)} placeholder="081234567890" />
                <p className="text-xs text-muted-foreground">Pembeli akan diarahkan ke nomor ini untuk konfirmasi pesanan.</p>
              </div>
              <div className="space-y-2">
                <Label>Info Rekening / Cara Bayar</Label>
                <textarea value={bankInfo} onChange={(e) => setBankInfo(e.target.value)} rows={4}
                  placeholder={'BCA 1234567890\na/n Nama Pemilik\n\nGoPay/OVO: 0812xxxx'}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
                <p className="text-xs text-muted-foreground">Ditampilkan ke pembeli yang memilih Transfer Bank di checkout.</p>
              </div>
              <div className="space-y-2">
                <Label>Ongkir Flat</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Rp</span>
                  <Input type="number" className="w-40" value={shippingFlat} onChange={(e) => setShippingFlat(Number(e.target.value))} />
                  <span className="text-sm text-muted-foreground">/ pengiriman ({formatRupiah(shippingFlat || 0)})</span>
                </div>
                <p className="text-xs text-muted-foreground">Berlaku saat pembeli memilih opsi "Dikirim". Pilih "Ambil di Toko" = gratis.</p>
              </div>
              <Button onClick={handleSaveOnline} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                <Save size={15} /> Simpan
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
            <Button onClick={handleSaveTax} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
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
                  <Input value={receiptFooter} onChange={(e) => setReceiptFooter(e.target.value)} placeholder="Pesan di bawah struk" />
                </div>
                <Button onClick={handleSaveReceipt} className="gap-2 w-full" style={{ background: 'oklch(0.55 0.22 264)' }}>
                  <Save size={15} /> Simpan
                </Button>
              </CardContent>
            </Card>

            {/* Struk Preview */}
            <Card>
              <CardHeader><CardTitle className="text-base">Preview Struk</CardTitle></CardHeader>
              <CardContent>
                <div className="bg-white border rounded-xl p-5 font-mono text-xs space-y-1 max-w-[220px] mx-auto shadow-sm">
                  {showLogo && <div className="text-center font-bold text-sm mb-2">{storeName || 'AKAPACK'}</div>}
                  {showAddress && storeAddress && <div className="text-center text-gray-500 mb-2">{storeAddress}</div>}
                  <div className="border-t border-dashed my-2" />
                  <div className="flex justify-between"><span>Contoh Produk A x2</span><span>20.000</span></div>
                  <div className="flex justify-between"><span>Contoh Produk B x1</span><span>15.000</span></div>
                  <div className="border-t border-dashed my-2" />
                  <div className="flex justify-between font-bold"><span>TOTAL</span><span>35.000</span></div>
                  <div className="border-t border-dashed my-2" />
                  <div className="text-center text-gray-500">{receiptFooter || 'Terima kasih!'}</div>
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
                <Input type="email" value={storeEmail} onChange={(e) => setStoreEmail(e.target.value)} placeholder="email@toko.com" />
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

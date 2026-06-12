export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left Panel — Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
        style={{ background: 'oklch(0.16 0.04 256)' }}>
        {/* Gradient overlay */}
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, oklch(0.16 0.04 256) 0%, oklch(0.22 0.06 260) 50%, oklch(0.18 0.05 256) 100%)' }} />
        
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'linear-gradient(oklch(0.88 0.01 250) 1px, transparent 1px), linear-gradient(90deg, oklch(0.88 0.01 250) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        {/* Glow effects */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full opacity-10 blur-3xl"
          style={{ background: 'oklch(0.55 0.22 264)' }} />
        <div className="absolute bottom-1/3 right-1/4 w-48 h-48 rounded-full opacity-10 blur-3xl"
          style={{ background: 'oklch(0.65 0.18 160)' }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg"
              style={{ background: 'oklch(0.55 0.22 264)' }}>
              A
            </div>
            <span className="text-white text-xl font-bold tracking-tight">AKAPACK</span>
          </div>

          {/* Center content */}
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ background: 'oklch(0.55 0.22 264 / 0.2)', color: 'oklch(0.75 0.18 264)', border: '1px solid oklch(0.55 0.22 264 / 0.3)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                Platform POS Modern
              </div>
              <h1 className="text-4xl font-bold leading-tight" style={{ color: 'oklch(0.95 0.01 250)' }}>
                Kelola Bisnis Retail<br />
                <span style={{ color: 'oklch(0.65 0.2 264)' }}>Lebih Cerdas</span>
              </h1>
              <p className="text-base leading-relaxed" style={{ color: 'oklch(0.65 0.02 250)' }}>
                Satu platform untuk kasir, inventori, laporan, dan pelanggan. Dirancang untuk UMKM Indonesia.
              </p>
            </div>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2">
              {['POS Kasir', 'Inventori Real-time', 'Laporan Lengkap', 'Multi Kasir', 'Manajemen Stok'].map((f) => (
                <span key={f} className="px-3 py-1 rounded-full text-xs font-medium"
                  style={{ background: 'oklch(0.22 0.04 256)', color: 'oklch(0.75 0.02 250)', border: '1px solid oklch(0.3 0.04 256)' }}>
                  {f}
                </span>
              ))}
            </div>
          </div>

          {/* Bottom stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { value: '500+', label: 'Produk dikelola' },
              { value: '99.9%', label: 'Uptime sistem' },
              { value: '24/7', label: 'Akses kapanpun' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-bold" style={{ color: 'oklch(0.65 0.2 264)' }}>{stat.value}</div>
                <div className="text-xs mt-1" style={{ color: 'oklch(0.55 0.02 250)' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold"
              style={{ background: 'oklch(0.55 0.22 264)' }}>
              A
            </div>
            <span className="font-bold text-lg">AKAPACK</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

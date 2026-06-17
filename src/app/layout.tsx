import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "AKAPACK — Platform POS & Manajemen Bisnis",
    template: "%s | AKAPACK",
  },
  description:
    "Platform manajemen bisnis retail terpadu — kasir, inventori, laporan, dan pelanggan dalam satu sistem.",
  keywords: ["POS", "kasir", "inventori", "retail", "manajemen bisnis", "AKAPACK"],
  icons: { icon: "/icon-512.png", apple: "/icon-256.png" },
  appleWebApp: { capable: true, title: "AKAPACK", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          {children}
          <Toaster
            position="top-right"
            richColors
            closeButton
            toastOptions={{
              duration: 4000,
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}

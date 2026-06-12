import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            duration: 4000,
          }}
        />
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ShopSave — Unduh Video Shopee Tanpa Watermark",
  description:
    "Alat gratis untuk mengunduh video produk Shopee tanpa watermark dalam kualitas asli (HD). Tanpa iklan, tanpa aplikasi, cepat dan aman. Cukup tempel tautan produk.",
  keywords: [
    "shopee video downloader",
    "download video shopee",
    "video shopee tanpa watermark",
    "unduh video shopee",
    "shopee tanpa watermark",
    "download video produk shopee",
  ],
  authors: [{ name: "ShopSave" }],
  icons: { icon: "/logo.svg" },
  openGraph: {
    title: "ShopSave — Unduh Video Shopee Tanpa Watermark",
    description:
      "Tempel tautan produk Shopee, klik Unduh, dan simpan videonya tanpa watermark dalam kualitas asli. Gratis, tanpa iklan.",
    siteName: "ShopSave",
    type: "website",
    locale: "id_ID",
  },
  twitter: {
    card: "summary_large_image",
    title: "ShopSave — Unduh Video Shopee Tanpa Watermark",
    description: "Tempel tautan, klik Unduh, simpan video Shopee tanpa watermark. Gratis & tanpa iklan.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1917" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen flex flex-col`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}

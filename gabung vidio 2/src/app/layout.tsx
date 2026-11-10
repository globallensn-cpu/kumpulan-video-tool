import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: "TokForge — Studio Gabung Video AI TikTok-Ready",
  description:
    "Gabung beberapa video jadi satu, encode otomatis sesuai spesifikasi TikTok (H.264 1080×1920 AAC), plus metadata SEO siap upload — judul, caption, hashtag, keyword dari analisis AI.",
  keywords: [
    "gabung video",
    "TikTok",
    "encode video",
    "H.264",
    "metadata SEO TikTok",
    "AI video",
    "video merger",
    "kreator Indonesia",
  ],
  authors: [{ name: "TokForge" }],
  openGraph: {
    title: "TokForge — Studio Gabung Video AI TikTok-Ready",
    description:
      "Upload klip → 1 klik → video tergabung sesuai spesifikasi TikTok + judul, caption, hashtag & keyword SEO dari AI.",
    type: "website",
    locale: "id_ID",
    siteName: "TokForge",
  },
  twitter: {
    card: "summary",
    title: "TokForge — Studio Gabung Video AI TikTok-Ready",
    description:
      "Gabung video → encode TikTok-spec otomatis → metadata SEO dari AI. Tanpa editing ribet.",
  },
  robots: { index: true, follow: true },
  icons: {
    icon: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090B",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}

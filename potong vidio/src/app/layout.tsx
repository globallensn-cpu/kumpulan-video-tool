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
  title: "PotongVideo — Split Video Jadi Bagian Per 10 Detik",
  description: "Aplikasi web untuk memotong video menjadi bagian-bagian kecil per 10 detik (durasi bisa diatur). Cepat, gratis, tanpa watermark.",
  keywords: ["potong video", "split video", "video 10 detik", "ffmpeg", "pemotong video"],
  authors: [{ name: "PotongVideo" }],
  applicationName: "PotongVideo",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "PotongVideo",
    description: "Split video jadi bagian kecil per 10 detik — cepat & gratis",
    url: "https://chat.z.ai",
    siteName: "Z.ai",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PotongVideo",
    description: "Split video jadi bagian kecil per 10 detik — cepat & gratis",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}

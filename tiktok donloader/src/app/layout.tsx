import type { Metadata } from "next";
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
  title: "TikDown — Download Video TikTok Tanpa Watermark (Original Size)",
  description:
    "Download video TikTok dari link tanpa watermark, kualitas asli/original, caption siap copy, musik MP3, dan cover. Gratis dan cepat.",
  keywords: ["TikTok downloader", "download TikTok tanpa watermark", "TikTok save", "caption TikTok"],
  authors: [{ name: "TikDown" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "TikDown — TikTok Downloader Tanpa Watermark",
    description: "Tempel link TikTok, unduh video original size tanpa watermark, caption siap copy.",
    siteName: "TikDown",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}

"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DownloaderTool from "@/components/downloader-tool";
import FrameExtractor from "@/components/frame-extractor";
import { Download, Scissors } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-[#08080d] text-zinc-100 relative">
      {/* Decorative background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-[15%] h-96 w-96 rounded-full bg-[#25F4EE] opacity-[0.06] blur-3xl" />
        <div className="absolute top-[30%] right-[5%] h-[28rem] w-[28rem] rounded-full bg-[#FE2C55] opacity-[0.07] blur-3xl" />
        <div className="absolute bottom-0 left-[5%] h-72 w-72 rounded-full bg-[#25F4EE] opacity-[0.04] blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#25F4EE] to-[#FE2C55] shadow-lg shadow-[#FE2C55]/20">
              <Download className="h-5 w-5 text-black" strokeWidth={2.5} />
            </div>
            <div className="leading-tight">
              <p className="font-bold tracking-tight">TikDown</p>
              <p className="text-[11px] text-zinc-400">TikTok Toolkit</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-[#25F4EE]/40 bg-[#25F4EE]/5 px-2.5 py-0.5 text-xs font-semibold text-[#25F4EE]">
              Tanpa Watermark
            </span>
            <span className="inline-flex items-center rounded-full border border-[#FE2C55]/40 bg-[#FE2C55]/5 px-2.5 py-0.5 text-xs font-semibold text-[#FE2C55]">
              Original Size
            </span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 w-full">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          {/* Hero */}
          <section className="pt-10 sm:pt-14 pb-7 text-center">
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
              Download Video TikTok{" "}
              <span className="bg-gradient-to-r from-[#25F4EE] to-[#FE2C55] bg-clip-text text-transparent">
                Tanpa Watermark
              </span>
            </h1>
            <p className="mt-4 text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto">
              Tempel link TikTok untuk download video kualitas asli dengan caption siap copy —
              atau unggah video untuk mengekstrak frame-nya jadi foto. Gratis, tanpa aplikasi tambahan.
            </p>
          </section>

          {/* Tools */}
          <Tabs defaultValue="download" className="w-full">
            <TabsList className="grid grid-cols-2 w-full max-w-md mx-auto h-12 bg-white/5 border border-white/10 rounded-xl p-1">
              <TabsTrigger
                value="download"
                className="h-10 rounded-lg text-sm data-[state=active]:bg-[#FE2C55] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-[#FE2C55]/25 text-zinc-300"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Video
              </TabsTrigger>
              <TabsTrigger
                value="frames"
                className="h-10 rounded-lg text-sm data-[state=active]:bg-[#25F4EE] data-[state=active]:text-black data-[state=active]:shadow-lg data-[state=active]:shadow-[#25F4EE]/25 text-zinc-300"
              >
                <Scissors className="h-4 w-4 mr-2" />
                Ekstrak Frame
              </TabsTrigger>
            </TabsList>

            <TabsContent value="download" className="mt-7 focus-visible:outline-none">
              <DownloaderTool />
            </TabsContent>
            <TabsContent value="frames" className="mt-7 focus-visible:outline-none">
              <FrameExtractor />
            </TabsContent>
          </Tabs>

          <div className="h-8" />
        </div>
      </main>

      {/* Footer — sticky bottom */}
      <footer className="relative z-10 mt-auto border-t border-white/5 bg-black/40 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-500">
          <p>
            <span className="font-semibold text-zinc-400">TikDown</span> — Download video TikTok
            tanpa watermark &amp; ekstrak frame foto dari video.
          </p>
          <p>Gunakan hanya untuk konten milik Anda sendiri atau dengan izin pemiliknya.</p>
        </div>
      </footer>
    </div>
  );
}

"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { Layers, ShieldCheck, Sparkles, Zap } from "lucide-react"
import { Stepper } from "@/components/studio/stepper"
import { UploadZone } from "@/components/studio/upload-zone"
import { ClipList } from "@/components/studio/clip-list"
import { SettingsPanel } from "@/components/studio/settings-panel"
import { ProcessPanel } from "@/components/studio/process-panel"
import { ResultPanel } from "@/components/studio/result-panel"
import { SpecSidebar } from "@/components/studio/spec-sidebar"
import { useToast } from "@/hooks/use-toast"
import { useStudio } from "@/lib/store"
import type { ClipDTO, JobDTO } from "@/lib/types"

const HERO_CHIPS = ["H.264 High", "1080×1920 · 9:16", "AAC 128k", "+faststart", "timescale 15360"]

export default function Home() {
  const { clips, settings, job, setClips, setJob } = useStudio()
  const [starting, setStarting] = React.useState(false)
  const { toast } = useToast()
  const resultRef = React.useRef<HTMLDivElement>(null)

  // Muat state awal dari server (pool klip + job aktif/terakhir)
  React.useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const [clipsRes, jobRes] = await Promise.all([
          fetch("/api/clips"),
          fetch("/api/jobs/active"),
        ])
        const clipsData = (await clipsRes.json()) as { clips?: ClipDTO[] }
        const jobData = (await jobRes.json()) as { job?: JobDTO | null }
        if (!alive) return
        if (Array.isArray(clipsData.clips)) setClips(clipsData.clips)
        if (jobData.job) setJob(jobData.job)
      } catch {
        // Server belum siap — biarkan state kosong
      }

      // Cek kesehatan lingkungan (DB + FFmpeg) — peringatkan dulu sebelum user upload
      try {
        const hRes = await fetch("/api/health")
        const h = (await hRes.json()) as {
          ok?: boolean
          ffmpeg?: boolean
          ffprobe?: boolean
          db?: boolean
        }
        if (alive && h.ok === false) {
          toast({
            title: "Lingkungan server belum siap",
            description:
              !h.ffmpeg || !h.ffprobe
                ? "FFmpeg/ffprobe tidak tersedia di server — proses gabung & encode tidak akan berjalan."
                : "Database tidak terjangkau — data studio mungkin tidak tersimpan.",
            variant: "destructive",
          })
        }
      } catch {
        // health check opsional — abaikan bila gagal
      }
    })()
    return () => {
      alive = false
    }
  }, [toast])

  const processing = job?.status === "processing" || job?.status === "queued"

  // Polling status job selama pipeline berjalan — tahan gangguan jaringan sesaat
  React.useEffect(() => {
    if (!processing) return
    let failures = 0
    const timer = window.setInterval(async () => {
      try {
        const r = await fetch("/api/jobs/active")
        const d = (await r.json()) as { job?: JobDTO | null }
        failures = 0
        if (d.job) setJob(d.job)
      } catch {
        failures += 1
        if (failures === 5) {
          toast({
            title: "Koneksi ke server terputus",
            description: "Proses tetap berjalan di server — menunggu koneksi kembali…",
            variant: "destructive",
          })
        }
      }
    }, 1200)
    return () => window.clearInterval(timer)
  }, [processing, setJob, toast])

  // Scroll halus ke hasil saat selesai
  React.useEffect(() => {
    if (job?.status === "done") {
      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 300)
    }
  }, [job?.status])

  const totalDuration = clips.reduce((a, c) => a + c.duration, 0)

  const startJob = async () => {
    if (clips.length === 0) {
      toast({ title: "Belum ada klip", description: "Unggah minimal 1 video dulu." })
      return
    }
    setStarting(true)
    try {
      const r = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clipIds: clips.map((c) => c.id), settings }),
      })
      const d = (await r.json()) as { jobId?: string; error?: string }
      if (!r.ok || !d.jobId) throw new Error(d.error ?? "Gagal memulai pipeline")
      const active = await fetch("/api/jobs/active").then((res) => res.json())
      if (active.job) setJob(active.job)
      toast({ title: "Pipeline dimulai 🚀", description: "FFmpeg & AI sedang bekerja — pantau progresnya di bawah." })
    } catch (e) {
      toast({
        title: "Gagal memulai",
        description: e instanceof Error ? e.message : "Terjadi kesalahan.",
        variant: "destructive",
      })
    } finally {
      setStarting(false)
    }
  }

  const cancelJob = async () => {
    if (!job) return
    try {
      await fetch(`/api/jobs/${job.id}/cancel`, { method: "POST" })
      toast({ title: "Proses dibatalkan" })
    } catch {
      toast({ title: "Gagal membatalkan", variant: "destructive" })
    }
  }

  const retrySame = async () => {
    if (!job) return
    try {
      await fetch(`/api/jobs/${job.id}`, { method: "DELETE" })
      setJob(null)
      toast({ title: "Siap ulangi", description: "Klip tetap tersedia — atur ulang bila perlu lalu jalankan lagi." })
    } catch {
      toast({ title: "Gagal reset job", variant: "destructive" })
    }
  }

  const resetAll = async () => {
    try {
      await fetch("/api/reset", { method: "DELETE" })
      setJob(null)
      setClips([])
      toast({ title: "Studio bersih ✨", description: "Siap untuk batch video berikutnya — upload lagi!" })
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch {
      toast({ title: "Gagal reset", variant: "destructive" })
    }
  }

  const step = !job ? (clips.length > 0 ? 1 : 0) : job.status === "done" ? 3 : 2
  const showResult = job?.status === "done" && job.videoUrl

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-[#09090B] text-zinc-100">
      {/* ================= HEADER ================= */}
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-[#09090B]/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#FE2C55] to-[#FF6B3D] shadow-lg shadow-[#FE2C55]/30">
              <Layers className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-[15px] font-bold leading-tight tracking-tight">TokForge</div>
              <div className="text-[10px] leading-tight text-zinc-500">AI Video Merger · TikTok-ready</div>
            </div>
            <span className="ml-1 hidden rounded-full border border-[#25F4EE]/30 bg-[#25F4EE]/10 px-2 py-0.5 text-[9px] font-bold tracking-widest text-[#5ff5ec] sm:inline-flex">
              AI STUDIO
            </span>
          </div>
          <div className="hidden md:block">
            <Stepper current={step} />
          </div>
          <div className="whitespace-nowrap text-[11px] tabular-nums text-zinc-400 md:hidden">
            Langkah {step + 1}/4
          </div>
        </div>
      </header>

      {/* ================= MAIN ================= */}
      <main className="relative flex-1">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_50%_at_50%_0%,rgba(254,44,85,0.09),transparent_70%),radial-gradient(40%_40%_at_80%_10%,rgba(37,244,238,0.05),transparent_70%)]" />

        <div className="relative mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          {/* Hero */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8 text-center sm:mb-10"
          >
            <div className="mx-auto mb-4 inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-[11px] text-zinc-400">
              <ShieldCheck className="h-3 w-3 text-emerald-400" />
              Encode lokal · spesifikasi hasil riset TikTok · Douyin · CapCut/剪映
            </div>
            <h1 className="mx-auto max-w-3xl text-balance text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Gabung video, encode <span className="text-gradient">TikTok-ready</span>,
              <br className="hidden sm:block" /> metadata SEO otomatis.
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-zinc-400">
              Upload klip → susun urutan → <strong className="font-semibold text-zinc-200">1 klik</strong>: FFmpeg
              menggabung &amp; meng-encode sesuai spesifikasi resmi TikTok, lalu AI menulis judul, caption, hashtag &amp;
              keyword yang mudah dibaca algoritma. Tanpa editing ribet — kamu fokus upload.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
              {HERO_CHIPS.map((c) => (
                <span
                  key={c}
                  className="rounded-full border border-zinc-800 bg-zinc-900/60 px-2.5 py-1 font-mono text-[10px] text-zinc-400"
                >
                  {c}
                </span>
              ))}
            </div>
          </motion.section>

          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
            {/* Kolom utama */}
            <div className="space-y-6">
              {/* 1. Upload */}
              <section aria-label="Unggah klip video" className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2.5 text-sm font-semibold">
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-[#FE2C55]/15 text-[11px] font-bold text-[#FF6B85]">
                      1
                    </span>
                    Unggah klip
                  </h2>
                  {clips.length > 0 && (
                    <span className="text-[11px] text-zinc-500">
                      {clips.length} klip · {clips.length >= 2 ? "siap digabung" : "tambah 1 lagi untuk menggabung"}
                    </span>
                  )}
                </div>
                <UploadZone disabled={processing} />
              </section>

              {/* 2. Susun */}
              <section aria-label="Susun urutan klip" className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2.5 text-sm font-semibold">
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-[#FE2C55]/15 text-[11px] font-bold text-[#FF6B85]">
                      2
                    </span>
                    Susun urutan
                  </h2>
                  {clips.length > 1 && <span className="text-[11px] text-zinc-500">Tarik ⠿ untuk mengubah urutan</span>}
                </div>
                <ClipList disabled={processing} />
              </section>

              {/* 3. Pengaturan */}
              <SettingsPanel disabled={processing} />

              {/* 4. Proses */}
              <ProcessPanel
                job={job}
                starting={starting}
                clipCount={clips.length}
                totalDuration={totalDuration}
                onStart={() => void startJob()}
                onCancel={() => void cancelJob()}
              />
            </div>

            {/* Sidebar riset */}
            <div className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pb-2">
              <SpecSidebar settings={settings} />
            </div>
          </div>

          {/* 5. Hasil */}
          {showResult && job && (
            <div ref={resultRef} className="mt-8 scroll-mt-24">
              <ResultPanel job={job} onReset={() => void resetAll()} onRetrySame={() => void retrySame()} />
            </div>
          )}

          {/* Note bawah */}
          <p className="mt-10 flex items-center justify-center gap-1.5 text-center text-[11px] text-zinc-600">
            <Zap className="h-3 w-3" />
            Semua pemrosesan video berjalan lokal via FFmpeg — tidak ada klip yang dikirim ke mana pun kecuali proxy
            ringan untuk analisis AI.
          </p>
        </div>
      </main>

      {/* ================= FOOTER (sticky bottom) ================= */}
      <footer className="mt-auto border-t border-zinc-800/80 bg-[#09090B]/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <span className="grid h-5 w-5 place-items-center rounded-md bg-gradient-to-br from-[#FE2C55] to-[#FF6B3D]">
              <Sparkles className="h-3 w-3 text-white" />
            </span>
            <span>
              <strong className="font-semibold text-zinc-400">TokForge</strong> — dibuat untuk kreator Indonesia
            </span>
          </div>
          <div className="text-[10px] text-zinc-600">
            Riset: TikTok Help · Douyin 抖音 · CapCut/剪映 · FFmpeg · satu klik dari upload → viral
          </div>
        </div>
      </footer>
    </div>
  )
}

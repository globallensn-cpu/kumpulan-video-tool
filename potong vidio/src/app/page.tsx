"use client"

import * as React from "react"
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  Film,
  HardDrive,
  Hourglass,
  Loader2,
  Music,
  Package,
  Play,
  RefreshCw,
  Scissors,
  Target,
  Timer,
  Upload,
  XCircle,
  Zap,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"

// ---------- tipe ----------

type Phase = "idle" | "ready" | "uploading" | "processing" | "done"
type Mode = "fast" | "precise"
type JobStatus = "queued" | "processing" | "done" | "error" | "cancelled"

interface VideoMeta {
  id: string
  name: string
  size: number
  duration: number
  width: number | null
  height: number | null
  hasAudio: boolean
}

interface UploadedVideo {
  id: string
  originalName: string
  size: number
  duration: number
  width: number | null
  height: number | null
  hasAudio: boolean
}

interface Segment {
  index: number
  file: string
  startTime: number
  duration: number
  size: number
  url: string
  downloadUrl: string
}

interface Job {
  id: string
  status: JobStatus
  mode: Mode
  segmentDuration: number
  rangeStart: number
  rangeEnd: number | null
  audioOnly: boolean
  totalDuration: number
  totalSegments: number
  completedSegments: number
  progress: number
  error?: string
  segments: Segment[]
}

// ---------- konstanta ----------

const ALLOWED_EXT = [
  "mp4", "mov", "mkv", "webm", "avi", "m4v",
  "mpg", "mpeg", "wmv", "flv", "3gp", "ts", "mts",
]
const MAX_SIZE = 500 * 1024 * 1024 // 500 MB
const PRESETS = [5, 10, 15, 30, 60]
const LS_VIDEO = "potongvideo:video"
const LS_JOB = "potongvideo:job"

// ---------- util ----------

function fmtSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0
  const s = Math.floor(sec % 60)
  const m = Math.floor((sec / 60) % 60)
  const h = Math.floor(sec / 3600)
  const mm = String(m).padStart(2, "0")
  const ss = String(s).padStart(2, "0")
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

function fmtDur(sec: number): string {
  if (sec < 60) {
    if (sec < 10 && !Number.isInteger(sec)) {
      return `${sec.toFixed(1).replace(".", ",")} detik`
    }
    return `${Math.round(sec)} detik`
  }
  const s = Math.round(sec % 60)
  const m = Math.floor(sec / 60)
  return `${m} mnt ${s} dtk`
}

function fileExt(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name)
  return m ? m[1].toLowerCase() : ""
}

// ---------- komponen utama ----------

export default function Home() {
  const { toast } = useToast()

  const [phase, setPhase] = React.useState<Phase>("idle")
  const [file, setFile] = React.useState<File | null>(null)
  const [videoUrl, setVideoUrl] = React.useState<string>("")
  const [meta, setMeta] = React.useState<VideoMeta | null>(null)
  const [bootChecked, setBootChecked] = React.useState(false)
  const [uploadPct, setUploadPct] = React.useState(0)
  const [uploadedBytes, setUploadedBytes] = React.useState(0)

  const [segDur, setSegDur] = React.useState(10)
  const [mode, setMode] = React.useState<Mode>("fast")
  const [useRange, setUseRange] = React.useState(false)
  const [rangeStart, setRangeStart] = React.useState(0)
  const [rangeEnd, setRangeEnd] = React.useState(10)
  const [audioOnly, setAudioOnly] = React.useState(false)

  const [previewError, setPreviewError] = React.useState(false)
  const [job, setJob] = React.useState<Job | null>(null)
  const [activeJobId, setActiveJobId] = React.useState<string | null>(null)
  const [previewSeg, setPreviewSeg] = React.useState<Segment | null>(null)

  const [dragOver, setDragOver] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const urlRef = React.useRef<string>("")
  const previewVideoRef = React.useRef<HTMLVideoElement | null>(null)

  const videoId = meta?.id || null
  const busy = phase === "uploading" || phase === "processing"
  const duration = meta?.duration ?? 0

  const rangeValid =
    !useRange ||
    (rangeStart >= 0 &&
      rangeEnd > rangeStart &&
      (duration <= 0 || (rangeEnd <= duration + 0.001 && rangeStart < duration)))
  const cutWindow = useRange && rangeValid && rangeEnd > rangeStart ? rangeEnd - rangeStart : duration
  const estSegments = cutWindow > 0 ? Math.max(1, Math.ceil(cutWindow / segDur - 1e-9)) : 0

  // ---------- pemilihan file ----------

  const acceptFile = React.useCallback(
    (f: File | undefined | null) => {
      if (!f) return
      const ext = fileExt(f.name)
      if (!ALLOWED_EXT.includes(ext)) {
        toast({
          title: "Format tidak didukung",
          description: "Gunakan MP4, MOV, MKV, WEBM, AVI, MPG, WMV, FLV, atau 3GP.",
          variant: "destructive",
        })
        return
      }
      if (f.size > MAX_SIZE) {
        toast({
          title: "File terlalu besar",
          description: `Ukuran ${fmtSize(f.size)} melebihi batas 500 MB.`,
          variant: "destructive",
        })
        return
      }

      // reset state lama
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      const url = URL.createObjectURL(f)
      urlRef.current = url
      try {
        window.localStorage.removeItem(LS_VIDEO)
        window.localStorage.removeItem(LS_JOB)
      } catch {}

      setFile(f)
      setVideoUrl(url)
      setJob(null)
      setActiveJobId(null)
      setUploadPct(0)
      setUploadedBytes(0)
      setMeta({
        id: "",
        name: f.name,
        size: f.size,
        duration: 0,
        width: null,
        height: null,
        hasAudio: true,
      })
      setPreviewError(false)
      setPhase("ready")

      // baca metadata lokal
      const v = document.createElement("video")
      v.preload = "metadata"
      v.onloadedmetadata = () => {
        setMeta((m) =>
          m && m.name === f.name
            ? {
                ...m,
                duration: Number.isFinite(v.duration) ? v.duration : 0,
                width: v.videoWidth || null,
                height: v.videoHeight || null,
              }
            : m
        )
      }
      v.onerror = () => setPreviewError(true)
      v.src = url
    },
    [toast]
  )

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    acceptFile(e.dataTransfer.files?.[0])
  }

  const resetVideo = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = ""
    try {
      window.localStorage.removeItem(LS_VIDEO)
      window.localStorage.removeItem(LS_JOB)
    } catch {}
    setFile(null)
    setVideoUrl("")
    setMeta(null)
    setJob(null)
    setActiveJobId(null)
    setUploadPct(0)
    setUploadedBytes(0)
    setPreviewError(false)
    setPhase("idle")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // ---------- pemulihan sesi terakhir (setelah refresh) ----------

  React.useEffect(() => {
    let vid: string | null = null
    try {
      vid = window.localStorage.getItem(LS_VIDEO)
    } catch {}
    if (!vid) {
      setBootChecked(true)
      return
    }

    let stale = false
    ;(async () => {
      try {
        const res = await fetch(`/api/video/${vid}`, { cache: "no-store" })
        if (!res.ok) throw new Error("video hilang")
        const data = await res.json()
        if (stale || !data.ok) return
        const v = data.video
        setMeta({
          id: v.id,
          name: v.originalName,
          size: v.size,
          duration: v.duration,
          width: v.width,
          height: v.height,
          hasAudio: v.hasAudio,
        })
        setVideoUrl(`/api/video/${v.id}/file`)
        setPhase("ready")

        // pulihkan job terakhir bila masih relevan
        let lastJobId: string | null = null
        try {
          lastJobId = window.localStorage.getItem(LS_JOB)
        } catch {}
        const jobs: Job[] = data.jobs ?? []
        const j = lastJobId ? jobs.find((x) => x.id === lastJobId) : null
        if (j) {
          setJob(j)
          if (j.status === "done") {
            setPhase("done")
          } else if (j.status === "queued" || j.status === "processing") {
            setPhase("processing")
            setActiveJobId(j.id)
          }
        }
      } catch {
        try {
          window.localStorage.removeItem(LS_VIDEO)
          window.localStorage.removeItem(LS_JOB)
        } catch {}
      } finally {
        if (!stale) setBootChecked(true)
      }
    })()

    return () => {
      stale = true
    }
  }, [])

  // ---------- polling status job ----------
  // Backoff eksponensial: 800ms awal, naik 2x saat gagal, maks 5 detik.
  // Reset ke 800ms begitu ada respons sukses.

  React.useEffect(() => {
    if (!activeJobId) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    let delay = 800
    let failCount = 0

    const poll = async () => {
      let ok = false
      try {
        const res = await fetch(`/api/job/${activeJobId}`, { cache: "no-store" })
        const data = await res.json()
        if (cancelled) return
        if (res.ok && data.ok) {
          ok = true
          const j: Job = data.job
          setJob(j)
          if (j.status === "done") {
            setPhase("done")
            try {
              window.localStorage.setItem(LS_JOB, j.id)
            } catch {}
            toast({
              title: "Video berhasil dipotong",
              description: `${j.segments.length} bagian siap diunduh.`,
            })
            return
          }
          if (j.status === "cancelled") {
            setPhase("ready")
            toast({
              title: "Pemotongan dibatalkan",
              description: "Kamu bisa memotong ulang kapan saja.",
            })
            return
          }
          if (j.status === "error") {
            setPhase("ready")
            toast({
              title: "Gagal memotong video",
              description: j.error ?? "Terjadi kesalahan saat memproses.",
              variant: "destructive",
            })
            return
          }
        }
      } catch {
        // jaringan sedang gangguan — coba lagi dengan backoff
      }
      if (cancelled) return
      if (ok) {
        failCount = 0
        delay = 800
      } else {
        failCount += 1
        delay = Math.min(5000, 800 * 2 ** Math.min(4, failCount - 1))
      }
      timer = setTimeout(poll, delay)
    }

    timer = setTimeout(poll, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [activeJobId, toast])

  // ---------- beforeunload: cegah tutup/refresh saat upload/proses ----------
  React.useEffect(() => {
    if (!busy) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Chrome butuh returnValue diset; modern browsers cukup preventDefault
      e.returnValue = ""
      return ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [busy])

  // ---------- unggah + potong ----------

  const uploadFile = (f: File): Promise<UploadedVideo> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open("POST", "/api/upload")
      xhr.setRequestHeader("X-Filename", encodeURIComponent(f.name))
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadPct(Math.round((e.loaded / e.total) * 100))
          setUploadedBytes(e.loaded)
        }
      }
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText)
          if (xhr.status === 200 && data.ok) resolve(data.video as UploadedVideo)
          else reject(new Error(data.error || "Unggah gagal."))
        } catch {
          reject(new Error("Unggah gagal."))
        }
      }
      xhr.onerror = () => reject(new Error("Koneksi terputus saat mengunggah."))
      xhr.send(f)
    })
  }

  const handleCut = async () => {
    if ((!file && !videoId) || busy) return
    try {
      let vid = videoId
      if (!vid) {
        if (!file) return
        setPhase("uploading")
        setUploadPct(0)
        setUploadedBytes(0)
        const uploaded = await uploadFile(file)
        vid = uploaded.id
        setMeta({
          id: uploaded.id,
          name: uploaded.originalName,
          size: uploaded.size,
          duration: uploaded.duration,
          width: uploaded.width,
          height: uploaded.height,
          hasAudio: uploaded.hasAudio,
        })
        try {
          window.localStorage.setItem(LS_VIDEO, uploaded.id)
        } catch {}
      }

      setPhase("processing")
      setJob(null)
      const res = await fetch("/api/split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: vid,
          segmentDuration: segDur,
          mode,
          ...(useRange && rangeValid ? { rangeStart, rangeEnd: Math.round(rangeEnd * 10) / 10 } : {}),
          audioOnly,
        }),
      })
      const data = await res.json().catch(() => ({ ok: false, error: "Respons server tidak valid." }))
      if (!res.ok || !data.ok) throw new Error(data.error || "Gagal memotong video.")
      setActiveJobId(data.job.id as string)
      setJob(data.job as Job)
    } catch (err) {
      setPhase(file || videoId ? "ready" : "idle")
      toast({
        title: "Terjadi kesalahan",
        description: err instanceof Error ? err.message : "Silakan coba lagi.",
        variant: "destructive",
      })
    }
  }

  const handleCancel = async () => {
    if (!activeJobId) return
    try {
      const res = await fetch(`/api/job/${activeJobId}/cancel`, { method: "POST" })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok) {
        const j: Job = data.job
        setJob(j)
        if (j.status === "cancelled") {
          setPhase("ready")
          toast({
            title: "Pemotongan dibatalkan",
            description: "Kamu bisa memotong ulang kapan saja.",
          })
        }
      }
    } catch {
      toast({
        title: "Gagal membatalkan",
        description: "Coba beberapa saat lagi.",
        variant: "destructive",
      })
    }
  }

  // ---------- render ----------

  // boot: cek sesi tersimpan dulu agar tidak kedip
  if (!bootChecked) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-950 text-zinc-100">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" aria-hidden="true" />
        <p className="text-sm text-zinc-400">Memeriksa sesi terakhir…</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800/80">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-zinc-950">
              <Scissors className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-base font-bold leading-tight sm:text-lg">PotongVideo</p>
              <p className="text-xs text-zinc-400">Split video per 10 detik</p>
            </div>
          </div>
          <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/10">
            Gratis &amp; tanpa watermark
          </Badge>
        </div>
      </header>

      {/* Konten utama */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {/* Hero */}
        <section className="mb-8 text-center sm:mb-10">
          <h1 className="mx-auto max-w-2xl text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            Potong video jadi bagian kecil{" "}
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              per 10 detik
            </span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-400 sm:text-base">
            Unggah video, atur durasi tiap potongan (atau pilih rentang tertentu), lalu unduh
            hasilnya satu per satu atau sekaligus dalam ZIP — bahkan ekstrak audionya jadi MP3.
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Langkah 1: video */}
          <Card className="border-zinc-800 bg-zinc-900/60 shadow-none">
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-zinc-950">
                  1
                </span>
                <CardTitle className="text-base sm:text-lg">Pilih Video</CardTitle>
              </div>
              <CardDescription>
                Tarik &amp; lepas file video, atau klik untuk memilih dari perangkatmu.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*,.mkv,.avi,.mpg,.mpeg,.wmv,.flv,.ts,.mts,.m4v"
                className="sr-only"
                aria-label="Pilih file video"
                onChange={(e) => acceptFile(e.target.files?.[0])}
              />

              {!file && !videoUrl ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`flex min-h-44 w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
                    dragOver
                      ? "border-amber-400 bg-amber-500/10"
                      : "border-zinc-700 bg-zinc-950/40 hover:border-amber-500/60 hover:bg-zinc-950/70"
                  }`}
                  aria-label="Area unggah video: tarik dan lepas file di sini"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
                    <Upload className="h-6 w-6 text-amber-400" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-semibold">Tarik &amp; lepas video di sini</p>
                    <p className="mt-1 text-sm text-zinc-400">
                      atau <span className="text-amber-400 underline underline-offset-2">pilih file</span>
                    </p>
                  </div>
                  <p className="text-xs text-zinc-500">
                    MP4, MOV, MKV, WEBM, AVI, dll. Maksimal 500 MB.
                  </p>
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-black">
                    {previewError ? (
                      <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-zinc-950 px-4 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800">
                          <Film className="h-7 w-7 text-amber-400" aria-hidden="true" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-zinc-200">
                            Pratinjau tidak tersedia di browser
                          </p>
                          <p className="mt-1 max-w-xs text-xs leading-relaxed text-zinc-500">
                            Beberapa format (mis. MKV, AVI, WMV) tidak bisa diputar di browser,
                            tetapi tetap bisa dipotong. Klik “Potong Video” untuk memproses.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <video
                          ref={previewVideoRef}
                          src={videoUrl}
                          controls
                          preload="metadata"
                          onError={() => setPreviewError(true)}
                          className="aspect-video w-full"
                        />
                        {/* penanda posisi potongan di timeline */}
                        {duration > 0 && segDur > 0 && estSegments > 0 && (
                          <div
                            className="pointer-events-none absolute inset-0"
                            aria-hidden="true"
                          >
                            {/* sorotan rentang terpilih */}
                            {useRange && rangeValid && rangeEnd > rangeStart && (
                              <div
                                className="absolute inset-y-0 border-x-2 border-amber-400/70 bg-amber-400/15"
                                style={{
                                  left: `${(rangeStart / duration) * 100}%`,
                                  width: `${((rangeEnd - rangeStart) / duration) * 100}%`,
                                }}
                              />
                            )}
                            {/* garis batas antar potongan */}
                            {Array.from({ length: Math.max(0, estSegments - 1) }).map((_, i) => {
                              const t = (useRange && rangeValid ? rangeStart : 0) + (i + 1) * segDur
                              if (t >= duration) return null
                              return (
                                <div
                                  key={i}
                                  className="absolute inset-y-0 w-0.5 bg-white/50"
                                  style={{ left: `${(t / duration) * 100}%` }}
                                />
                              )
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-300">
                    <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-zinc-800/80 px-2.5 py-1.5">
                      <Film className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
                      <span className="truncate font-medium">{meta?.name ?? file?.name}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800/80 px-2.5 py-1.5">
                      <HardDrive className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
                      {fmtSize(meta?.size ?? file?.size ?? 0)}
                    </span>
                    {duration > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800/80 px-2.5 py-1.5">
                        <Clock className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
                        {fmtTime(duration)}
                      </span>
                    )}
                    {meta?.width && meta?.height ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800/80 px-2.5 py-1.5">
                        <Timer className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
                        {meta.width}×{meta.height}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-zinc-100"
                      onClick={resetVideo}
                      disabled={busy}
                    >
                      <RefreshCw className="h-4 w-4" aria-hidden="true" />
                      Ganti Video
                    </Button>
                    {videoId && (
                      <span className="text-xs text-zinc-500">
                        Video sudah terunggah — potong ulang tanpa unggah lagi
                      </span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Langkah 2: pengaturan */}
          <Card className="flex flex-col border-zinc-800 bg-zinc-900/60 shadow-none">
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-zinc-950">
                  2
                </span>
                <CardTitle className="text-base sm:text-lg">Pengaturan Potongan</CardTitle>
              </div>
              <CardDescription>
                Secara bawaan video dipotong per 10 detik. Kamu bisa mengubahnya di sini.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-5">
              {/* durasi */}
              <div className="space-y-2.5">
                <p className="text-sm font-medium text-zinc-200">Durasi per potongan</p>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSegDur(p)}
                      aria-pressed={segDur === p}
                      className={`min-h-11 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                        segDur === p
                          ? "bg-amber-500 text-zinc-950"
                          : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                      }`}
                    >
                      {p} detik
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-400">Atur manual:</span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Kurangi durasi 1 detik"
                      className="h-9 w-9 border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                      onClick={() => setSegDur((d) => Math.max(1, d - 1))}
                      disabled={busy}
                    >
                      −
                    </Button>
                    <Input
                      type="number"
                      min={1}
                      max={600}
                      value={segDur}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        if (Number.isFinite(v) && v >= 1 && v <= 600) setSegDur(Math.round(v))
                        else if (e.target.value === "") setSegDur(1)
                      }}
                      className="h-9 w-20 border-zinc-700 bg-zinc-950 text-center text-zinc-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      aria-label="Durasi per potongan dalam detik"
                      disabled={busy}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Tambah durasi 1 detik"
                      className="h-9 w-9 border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                      onClick={() => setSegDur((d) => Math.min(600, d + 1))}
                      disabled={busy}
                    >
                      +
                    </Button>
                    <span className="text-sm text-zinc-400">detik</span>
                  </div>
                </div>
              </div>

              {/* mode */}
              <div className="space-y-2.5">
                <p className="text-sm font-medium text-zinc-200">Mode pemotongan</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setMode("fast")}
                    aria-pressed={mode === "fast"}
                    className={`min-h-24 flex-1 rounded-xl border p-3 text-left transition-colors ${
                      mode === "fast"
                        ? "border-amber-500 bg-amber-500/10"
                        : "border-zinc-700 bg-zinc-950/40 hover:border-zinc-600"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Zap
                        className={`h-4 w-4 ${mode === "fast" ? "text-amber-400" : "text-zinc-400"}`}
                        aria-hidden="true"
                      />
                      <span className="text-sm font-semibold">Cepat</span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                      Tanpa konversi ulang — proses sangat cepat. Titik potong mengikuti
                      keyframe, durasi bisa meleset sedikit.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("precise")}
                    aria-pressed={mode === "precise"}
                    className={`min-h-24 flex-1 rounded-xl border p-3 text-left transition-colors ${
                      mode === "precise"
                        ? "border-amber-500 bg-amber-500/10"
                        : "border-zinc-700 bg-zinc-950/40 hover:border-zinc-600"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Target
                        className={`h-4 w-4 ${mode === "precise" ? "text-amber-400" : "text-zinc-400"}`}
                        aria-hidden="true"
                      />
                      <span className="text-sm font-semibold">Presisi</span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                      Dipotong ulang (re-encode) — durasi tepat sesuai pengaturan, tetapi
                      proses lebih lama.
                    </p>
                  </button>
                </div>
              </div>

              {/* rentang kustom */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-700 bg-zinc-950/40 p-3">
                  <div className="flex items-start gap-2.5">
                    <Scissors className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-semibold">Potong rentang tertentu</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
                        Ambil hanya bagian {useRange ? "yang dipilih" : "tertentu"} dari video, lalu potong per {segDur} detik.
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={useRange}
                    disabled={busy}
                    onCheckedChange={(v) => {
                      setUseRange(v)
                      if (v && rangeEnd <= rangeStart) {
                        setRangeEnd(duration > 0 ? Math.floor(duration) : 10)
                      }
                    }}
                    aria-label="Aktifkan potong rentang tertentu"
                    className="data-[state=checked]:bg-amber-500"
                  />
                </div>
                {useRange && (
                  <div className="space-y-3 rounded-xl border border-zinc-700 bg-zinc-950/40 p-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="range-start" className="text-xs text-zinc-300">
                          Mulai (detik)
                        </Label>
                        <Input
                          id="range-start"
                          type="number"
                          min={0}
                          max={Math.max(1, Math.floor(duration))}
                          value={rangeStart}
                          disabled={busy}
                          onChange={(e) => setRangeStart(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                          className="h-10 border-zinc-700 bg-zinc-950 text-zinc-100"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="range-end" className="text-xs text-zinc-300">
                          Sampai (detik)
                        </Label>
                        <Input
                          id="range-end"
                          type="number"
                          min={1}
                          max={Math.max(1, Math.ceil(duration))}
                          value={rangeEnd}
                          disabled={busy}
                          onChange={(e) => setRangeEnd(Math.max(1, Math.floor(Number(e.target.value) || 0)))}
                          className="h-10 border-zinc-700 bg-zinc-950 text-zinc-100"
                        />
                      </div>
                    </div>
                    {/* Slider visual rentang: dua handle di atas timeline mini */}
                    {duration > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] text-zinc-500">
                          <span>0:00</span>
                          <span className="text-zinc-400">Geser handle untuk atur rentang</span>
                          <span>{fmtTime(duration)}</span>
                        </div>
                        <div className="relative h-8 select-none">
                          {/* track */}
                          <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-zinc-700" />
                          {/* range terpilih */}
                          <div
                            className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-amber-500"
                            style={{
                              left: `${(rangeStart / duration) * 100}%`,
                              width: `${(Math.max(0, rangeEnd - rangeStart) / duration) * 100}%`,
                            }}
                          />
                          {/* handle mulai */}
                          <input
                            type="range"
                            min={0}
                            max={Math.floor(duration)}
                            step={1}
                            value={Math.min(rangeStart, Math.floor(duration) - 1)}
                            disabled={busy}
                            onChange={(e) => {
                              const v = Number(e.target.value)
                              setRangeStart(Math.min(v, rangeEnd - 1))
                            }}
                            aria-label="Atur detik awal rentang"
                            className="pv-range-thumb absolute inset-0 w-full appearance-none bg-transparent"
                          />
                          {/* handle akhir */}
                          <input
                            type="range"
                            min={1}
                            max={Math.ceil(duration)}
                            step={1}
                            value={Math.max(rangeEnd, rangeStart + 1)}
                            disabled={busy}
                            onChange={(e) => {
                              const v = Number(e.target.value)
                              setRangeEnd(Math.max(v, rangeStart + 1))
                            }}
                            aria-label="Atur detik akhir rentang"
                            className="pv-range-thumb absolute inset-0 w-full appearance-none bg-transparent"
                          />
                        </div>
                      </div>
                    )}
                    {/* Tombol ambil posisi playback dari pratinjau */}
                    {!previewError && duration > 0 && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            const v = previewVideoRef.current
                            if (!v) return
                            const t = Math.floor(v.currentTime)
                            if (t < duration) {
                              setRangeStart(Math.max(0, Math.min(t, rangeEnd - 1)))
                              toast({
                                title: "Awal rentang diatur",
                                description: `Posisi playback saat ini: ${fmtTime(t)}.`,
                              })
                            }
                          }}
                          className="h-8 border-zinc-700 bg-zinc-800 px-3 text-xs font-semibold text-zinc-200 hover:bg-zinc-700"
                        >
                          <Target className="h-3.5 w-3.5" aria-hidden="true" />
                          Set Mulai ke Posisi Video
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            const v = previewVideoRef.current
                            if (!v) return
                            const t = Math.floor(v.currentTime)
                            if (t > rangeStart) {
                              setRangeEnd(Math.min(t, Math.ceil(duration)))
                              toast({
                                title: "Akhir rentang diatur",
                                description: `Posisi playback saat ini: ${fmtTime(t)}.`,
                              })
                            }
                          }}
                          className="h-8 border-zinc-700 bg-zinc-800 px-3 text-xs font-semibold text-zinc-200 hover:bg-zinc-700"
                        >
                          <Target className="h-3.5 w-3.5" aria-hidden="true" />
                          Set Akhir ke Posisi Video
                        </Button>
                      </div>
                    )}
                    {duration > 0 ? (
                      <p className={`text-xs ${rangeValid ? "text-zinc-400" : "text-red-400"}`}>
                        {rangeValid
                          ? `Jendela terpilih: ${fmtTime(rangeStart)} – ${fmtTime(rangeEnd)} (${fmtDur(Math.max(0, rangeEnd - rangeStart))})`
                          : "Rentang tidak valid — akhir harus lebih besar dari awal dan tidak melebihi durasi video."}
                      </p>
                    ) : (
                      <p className="text-xs text-zinc-500">
                        Durasi belum terbaca — rentang akan divalidasi setelah video diproses.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* mode audio MP3 */}
              <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-700 bg-zinc-950/40 p-3">
                <div className="flex items-start gap-2.5">
                  <Music className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold">Hasil audio saja (MP3)</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
                      {meta && !meta.hasAudio
                        ? "Video ini tidak memiliki trek audio."
                        : "Setiap potongan berupa file MP3 — cocok untuk podcast atau lagu."}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={audioOnly}
                  disabled={busy || (meta != null && !meta.hasAudio && !!meta.id)}
                  onCheckedChange={setAudioOnly}
                  aria-label="Aktifkan hasil audio MP3 saja"
                  className="data-[state=checked]:bg-amber-500"
                />
              </div>

              {/* estimasi */}
              <div className="mt-auto rounded-xl border border-zinc-800 bg-zinc-950/50 p-3.5">
                {useRange && rangeValid && cutWindow > 0 ? (
                  <p className="text-sm text-zinc-300">
                    Rentang <span className="font-semibold text-zinc-100">{fmtTime(rangeStart)}–{fmtTime(rangeEnd)}</span>{" "}
                    ({fmtDur(cutWindow)}) akan menjadi sekitar{" "}
                    <span className="font-semibold text-amber-400">{estSegments} potongan</span> × {segDur} detik
                    {audioOnly ? " dalam bentuk MP3" : ""}.
                  </p>
                ) : duration > 0 ? (
                  <p className="text-sm text-zinc-300">
                    Video <span className="font-semibold text-zinc-100">{fmtTime(duration)}</span>{" "}
                    ({fmtDur(duration)}) akan menjadi sekitar{" "}
                    <span className="font-semibold text-amber-400">
                      {estSegments} potongan
                    </span>{" "}
                    × {segDur} detik{audioOnly ? " dalam bentuk MP3" : ""}
                    {estSegments > 1 && duration % segDur > 0.01
                      ? " (potongan terakhir lebih pendek)"
                      : ""}
                    .
                  </p>
                ) : (meta || file) && previewError ? (
                  <p className="text-sm text-zinc-400">
                    Durasi tidak bisa dibaca browser untuk format ini — jumlah potongan akan
                    dihitung otomatis setelah video diproses.
                  </p>
                ) : (
                  <p className="text-sm text-zinc-400">
                    Pilih video dulu untuk melihat estimasi jumlah potongan.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tombol potong */}
        <div className="mt-6 flex flex-col items-center gap-2">
          <Button
            size="lg"
            disabled={(!file && !videoId) || busy || (useRange && !rangeValid)}
            onClick={handleCut}
            className="h-13 w-full max-w-md min-h-12 rounded-xl bg-amber-500 text-base font-bold text-zinc-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400 disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                {phase === "uploading" ? "Mengunggah video…" : "Memotong video…"}
              </>
            ) : (
              <>
                <Scissors className="h-5 w-5" aria-hidden="true" />
                {job && phase === "done" ? "Potong Ulang dengan Setelan Ini" : "Potong Video"}
              </>
            )}
          </Button>
          {phase === "done" && videoId && (
            <p className="text-xs text-zinc-500">
              Video sudah ada di server — ubah durasi/mode lalu potong ulang, tanpa unggah ulang.
            </p>
          )}
        </div>

        {/* Langkah 3: progres & hasil */}
        {(phase === "uploading" || phase === "processing" || phase === "done" || job) && (
          <Card className="mt-6 border-zinc-800 bg-zinc-900/60 shadow-none">
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-zinc-950">
                  3
                </span>
                <CardTitle className="text-base sm:text-lg">Progres &amp; Hasil</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* error job */}
              {job?.status === "error" && (
                <Alert className="border-red-500/40 bg-red-500/10 text-red-300">
                  <AlertCircle className="h-4 w-4 !text-red-400" aria-hidden="true" />
                  <AlertTitle className="text-sm font-semibold">Pemotongan gagal</AlertTitle>
                  <AlertDescription className="text-xs text-red-300/90">
                    {job.error ?? "Terjadi kesalahan saat memproses video."}
                  </AlertDescription>
                </Alert>
              )}

              {/* progres unggah */}
              {phase === "uploading" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-zinc-300">
                      <Upload className="h-4 w-4 text-amber-400" aria-hidden="true" />
                      Mengunggah video ke server…
                    </span>
                    <span className="font-mono text-zinc-400">{uploadPct}%</span>
                  </div>
                  <Progress value={uploadPct} className="bg-zinc-800 [&>div]:bg-amber-500" />
                  <p className="text-xs text-zinc-500">
                    {fmtSize(uploadedBytes)} dari {fmtSize(meta?.size ?? file?.size ?? 0)} terkirim
                  </p>
                </div>
              )}

              {/* progres potong */}
              {phase === "processing" && job && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 text-zinc-300">
                      {job.status === "queued" ? (
                        <Hourglass className="h-4 w-4 animate-pulse text-amber-400" aria-hidden="true" />
                      ) : (
                        <Scissors className="h-4 w-4 animate-pulse text-amber-400" aria-hidden="true" />
                      )}
                      {job.status === "queued"
                        ? "Menunggu antrean — server sedang memproses pekerjaan lain…"
                        : job.mode === "precise"
                          ? `Memotong video — ${job.completedSegments}/${job.totalSegments} segmen selesai`
                          : "Memotong video…"}
                    </span>
                    <span className="flex items-center gap-3">
                      {job.status !== "queued" && (
                        <span className="font-mono text-zinc-400">{job.progress}%</span>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancel}
                        className="h-8 min-h-8 rounded-lg border-zinc-700 bg-zinc-800 px-3 text-xs font-semibold text-red-300 hover:bg-red-500/10 hover:text-red-200"
                      >
                        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        Batalkan
                      </Button>
                    </span>
                  </div>
                  <Progress
                    value={job.status === "queued" ? 0 : job.progress}
                    className="bg-zinc-800 [&>div]:bg-amber-500"
                  />
                  <p className="text-xs text-zinc-500">
                    Mode {job.mode === "fast" ? "Cepat" : "Presisi"} · target {job.totalSegments}{" "}
                    potongan × {job.segmentDuration} detik
                  </p>
                </div>
              )}

              {/* hasil */}
              {phase === "done" && job && job.status === "done" && job.segments.length > 0 && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-semibold text-zinc-100">
                          {job.segments.length} bagian berhasil dibuat
                        </p>
                        <p className="text-xs text-zinc-400">
                          Mode {job.mode === "fast" ? "Cepat" : "Presisi"}
                          {job.audioOnly ? " · hasil MP3" : ""}
                          {job.rangeEnd != null
                            ? ` · rentang ${fmtTime(job.rangeStart)}–${fmtTime(job.rangeEnd)}`
                            : ""}{" "}
                          · total {fmtSize(job.segments.reduce((a, s) => a + s.size, 0))} · file tersimpan
                          sementara di server (3 jam)
                        </p>
                      </div>
                    </div>
                    <Button
                      asChild
                      className="min-h-11 rounded-xl bg-emerald-500 font-semibold text-zinc-950 hover:bg-emerald-400"
                    >
                      <a href={`/api/job/${job.id}/zip`} download>
                        <Package className="h-4 w-4" aria-hidden="true" />
                        Unduh Semua (ZIP)
                      </a>
                    </Button>
                  </div>

                  <div className="nice-scrollbar max-h-96 overflow-y-auto rounded-xl border border-zinc-800">
                    <ul className="divide-y divide-zinc-800">
                      {job.segments.map((s) => (
                        <li
                          key={s.index}
                          className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-zinc-800/40 sm:px-4"
                        >
                          <span className="w-8 shrink-0 text-center font-mono text-xs text-zinc-500">
                            #{String(s.index + 1).padStart(2, "0")}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-zinc-100">
                              {fmtTime(s.startTime)} – {fmtTime(s.startTime + s.duration)}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {fmtDur(s.duration)} · {fmtSize(s.size)}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`Putar bagian ${s.index + 1}`}
                            className="h-9 w-9 border-zinc-700 bg-zinc-800 p-0 text-zinc-200 hover:bg-zinc-700"
                            onClick={() => setPreviewSeg(s)}
                          >
                            {job.audioOnly ? (
                              <Music className="h-4 w-4" aria-hidden="true" />
                            ) : (
                              <Play className="h-4 w-4" aria-hidden="true" />
                            )}
                          </Button>
                          <Button
                            asChild
                            size="sm"
                            aria-label={`Unduh bagian ${s.index + 1}`}
                            className="h-9 rounded-lg bg-amber-500 px-3 font-semibold text-zinc-950 hover:bg-amber-400"
                          >
                            <a href={s.downloadUrl} download>
                              <Download className="h-4 w-4" aria-hidden="true" />
                              <span className="hidden sm:inline">Unduh</span>
                            </a>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* hasil lama saat memotong ulang: tampilkan status saja */}
              {phase === "done" && job && job.status === "done" && job.segments.length === 0 && (
                <p className="text-sm text-zinc-400">Tidak ada segmen yang dihasilkan.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* dialog pratinjau segmen */}
        <Dialog open={previewSeg !== null} onOpenChange={(open) => !open && setPreviewSeg(null)}>
          <DialogContent className="max-w-3xl border-zinc-800 bg-zinc-900 sm:rounded-xl">
            <DialogHeader>
              <DialogTitle className="text-zinc-100">
                Bagian #{previewSeg ? previewSeg.index + 1 : ""}
              </DialogTitle>
              <DialogDescription>
                {previewSeg
                  ? `${fmtTime(previewSeg.startTime)} – ${fmtTime(
                      previewSeg.startTime + previewSeg.duration
                    )} · ${fmtDur(previewSeg.duration)} · ${fmtSize(previewSeg.size)}`
                  : ""}
              </DialogDescription>
            </DialogHeader>
            {previewSeg && job?.audioOnly ? (
              <audio
                src={previewSeg.url}
                controls
                autoPlay
                className="w-full rounded-lg border border-zinc-800 bg-black"
              />
            ) : previewSeg ? (
              <video
                src={previewSeg.url}
                controls
                autoPlay
                className="aspect-video w-full rounded-lg border border-zinc-800 bg-black"
              />
            ) : null}
          </DialogContent>
        </Dialog>

        {/* FAQ */}
        <section className="mt-10" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="text-center text-xl font-bold sm:text-2xl">
            Pertanyaan Umum
          </h2>
          <Accordion type="single" collapsible className="mt-5 space-y-2">
            <AccordionItem value="q1" className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4">
              <AccordionTrigger className="py-3.5 text-left text-sm font-semibold hover:no-underline">
                Berapa ukuran dan format file yang didukung?
              </AccordionTrigger>
              <AccordionContent className="pb-4 text-sm leading-relaxed text-zinc-400">
                Maksimal 500 MB per video. Format yang didukung: MP4, MOV, MKV, WEBM, AVI, M4V,
                MPG, MPEG, WMV, FLV, 3GP, TS, dan MTS. Hasil potongan selalu berupa MP4 (atau MP3
                jika kamu memilih mode audio).
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q2" className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4">
              <AccordionTrigger className="py-3.5 text-left text-sm font-semibold hover:no-underline">
                Apa bedanya mode Cepat dan Presisi?
              </AccordionTrigger>
              <AccordionContent className="pb-4 text-sm leading-relaxed text-zinc-400">
                Mode <span className="font-semibold text-zinc-200">Cepat</span> menyalin video apa
                adanya tanpa konversi ulang — proses hampir seketika, tetapi titik potong
                mengikuti keyframe sehingga durasi tiap bagian bisa meleset sedikit. Mode{" "}
                <span className="font-semibold text-zinc-200">Presisi</span> meng-encode ulang
                setiap bagian sehingga durasinya tepat per detik, dengan konsekuensi proses lebih
                lama.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q3" className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4">
              <AccordionTrigger className="py-3.5 text-left text-sm font-semibold hover:no-underline">
                Kalau saya menutup atau refresh halaman, hasilnya hilang?
              </AccordionTrigger>
              <AccordionContent className="pb-4 text-sm leading-relaxed text-zinc-400">
                Tidak. Proses berjalan di server, dan sesi terakhirmu dipulihkan otomatis saat kamu
                kembali membuka halaman — termasuk hasil yang sudah selesai. Kalau proses sedang
                berjalan, kamu juga bisa membatalkannya lewat tombol “Batalkan”.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q4" className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4">
              <AccordionTrigger className="py-3.5 text-left text-sm font-semibold hover:no-underline">
                Kenapa pratinjau video saya tidak muncul?
              </AccordionTrigger>
              <AccordionContent className="pb-4 text-sm leading-relaxed text-zinc-400">
                Beberapa format (mis. MKV, AVI, WMV) memakai codec yang tidak bisa diputar browser.
                Tenang — video tetap bisa dipotong normal. Setelah selesai, setiap potongan berupa
                MP4 yang bisa diputar di mana saja.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q5" className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4">
              <AccordionTrigger className="py-3.5 text-left text-sm font-semibold hover:no-underline">
                Berapa lama file saya disimpan di server?
              </AccordionTrigger>
              <AccordionContent className="pb-4 text-sm leading-relaxed text-zinc-400">
                Semua file (video asli dan hasil potongan) otomatis dihapus setelah 3 jam. Tidak
                ada yang dibagikan ke pihak lain, dan tidak ada watermark pada hasilnya.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-zinc-800/80">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-2 px-4 py-5 text-center text-xs text-zinc-500 sm:flex-row sm:px-6 sm:text-left">
          <p>
            <span className="font-semibold text-zinc-400">PotongVideo</span> — diproses dengan
            FFmpeg langsung di server.
          </p>
          <p>File otomatis dihapus dari server setelah 3 jam. Maksimal 500 MB per video.</p>
        </div>
      </footer>
    </div>
  )
}

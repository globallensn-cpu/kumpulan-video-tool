// ============================================================
// TokForge — Pipeline manager (singleton in-memory)
// Menjalankan: encode one-pass → proxy → AI vision → LLM SEO
// Progress realtime di memori; hasil final dipersist ke DB.
// Bertahan terhadap HMR (disimpan di globalThis).
// ============================================================

import path from "path"
import { mkdir, rm, stat } from "fs/promises"
import { db } from "@/lib/db"
import { buildMergeArgs, buildProxyArgs, probeVideo, runFfmpeg, type FfmpegHandle } from "@/lib/ffmpeg"
import { jobDir } from "@/lib/paths"
import { analyzeVideoContent, fallbackMetadata, generateTikTokMetadata } from "@/lib/ai"
import type { JobMemoryState, JobSettings, LogEntry, LogLevel } from "./types"

class CanceledError extends Error {
  constructor() {
    super("canceled")
  }
}

interface JobMemory {
  jobId: string
  stage: string
  progress: number
  logs: LogEntry[]
  handle: FfmpegHandle | null
  canceled: boolean
  finished: boolean
}

const g = globalThis as unknown as { __tokforgeMem?: Map<string, JobMemory> }
const mem: Map<string, JobMemory> = g.__tokforgeMem ?? new Map<string, JobMemory>()
g.__tokforgeMem = mem

export interface MergeInput {
  path: string
  duration: number
  hasAudio: boolean
  name: string
}

function log(m: JobMemory, level: LogLevel, msg: string): void {
  m.logs.push({ t: Date.now(), level, msg })
  if (m.logs.length > 150) m.logs.splice(0, m.logs.length - 150)
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function getMemory(jobId: string): JobMemoryState | null {
  const m = mem.get(jobId)
  if (!m) return null
  return { stage: m.stage as JobMemoryState["stage"], progress: Math.round(m.progress), logs: [...m.logs] }
}

export function isRunning(): boolean {
  for (const m of mem.values()) {
    if (!m.finished && !m.canceled) return true
  }
  return false
}

export function cancelJob(jobId: string): boolean {
  const m = mem.get(jobId)
  if (!m || m.finished) return false
  m.canceled = true
  m.handle?.kill()
  log(m, "warn", "Menerima perintah pembatalan…")
  return true
}

export function dropMemory(jobId: string): void {
  mem.delete(jobId)
}

export function clearMemory(): void {
  mem.clear()
}

export function startJob(jobId: string, inputs: MergeInput[], settings: JobSettings): void {
  const m: JobMemory = {
    jobId,
    stage: "prepare",
    progress: 2,
    logs: [],
    handle: null,
    canceled: false,
    finished: false,
  }
  mem.set(jobId, m)
  log(
    m,
    "ok",
    `Pipeline dimulai — ${inputs.length} klip · mode ${settings.aspect} · ${settings.fps} fps · kualitas ${settings.quality}`
  )
  void run(jobId, inputs, settings, m)
}

async function run(jobId: string, inputs: MergeInput[], settings: JobSettings, m: JobMemory): Promise<void> {
  try {
    const dir = jobDir(jobId)
    await mkdir(dir, { recursive: true })
    const totalDuration = inputs.reduce((a, c) => a + c.duration, 0)
    log(m, "info", `Durasi total output: ${totalDuration.toFixed(1)}s → target 1080×1920 @ ${settings.fps}fps`)

    // ================= STAGE: ENCODE (gabung + encode sekali jalan) =================
    m.stage = "encode"
    m.progress = 4
    await db.job.update({ where: { id: jobId }, data: { stage: "encode", progress: 4 } })

    const outPath = path.join(dir, "output.mp4")
    const args = buildMergeArgs(inputs, settings, outPath)
    log(m, "cmd", `ffmpeg … ${inputs.length} input · filter_complex concat → libx264 high@4.1 + aac 128k + faststart`)

    const handle = runFfmpeg(args, {
      totalDuration,
      onProgress: (f) => {
        m.progress = 4 + f * 68
      },
      // Merge video panjang butuh waktu — tapi jangan biarkan menggantung selamanya
      timeoutMs: 15 * 60 * 1000,
    })
    m.handle = handle
    await handle.promise
    if (m.canceled) throw new CanceledError()
    log(m, "ok", `Encode selesai → output.mp4 (H.264 High + AAC, satu generasi encode)`)

    // ================= Spesifikasi final =================
    const specs = await probeVideo(outPath)
    if (m.canceled) throw new CanceledError()
    const fileStat = await stat(outPath)
    const duration = specs.duration || totalDuration
    const bitrateKbps =
      specs.bitrate > 0 ? Math.round(specs.bitrate / 1000) : Math.round((fileStat.size * 8) / 1000 / Math.max(duration, 1))
    const specsJson = JSON.stringify({
      duration,
      size: fileStat.size,
      bitrateKbps,
      width: specs.width,
      height: specs.height,
      fps: settings.fps,
    })
    await db.job.update({ where: { id: jobId }, data: { specsJson, videoFilename: "output.mp4" } })
    log(
      m,
      "ok",
      `Spesifikasi final: ${specs.width}×${specs.height} · ${duration.toFixed(1)}s · ${(
        fileStat.size /
        1024 /
        1024
      ).toFixed(1)} MB · ±${Math.round(bitrateKbps / 1000)} Mbps`
    )
    m.progress = 74

    // ================= PROXY ringan untuk AI =================
    const proxyPath = path.join(dir, "proxy.mp4")
    const proxyHandle = runFfmpeg(buildProxyArgs(outPath, proxyPath, duration), {
      timeoutMs: 5 * 60 * 1000,
    })
    m.handle = proxyHandle
    await proxyHandle.promise
    if (m.canceled) throw new CanceledError()
    m.progress = 78
    log(m, "info", "Proxy ringan siap (480p · 2fps) — mengirim ke model vision AI…")

    // ================= STAGE: ANALYZE =================
    m.stage = "analyze"
    await db.job.update({ where: { id: jobId }, data: { stage: "analyze", progress: 80 } })
    let summary = ""
    try {
      summary = await analyzeVideoContent(proxyPath, duration)
      if (m.canceled) throw new CanceledError()
      log(m, "ok", `Analisis konten selesai — ${summary.length} karakter ringkasan`)
      await db.job.update({ where: { id: jobId }, data: { contentSummary: summary } })
    } catch (err) {
      if (m.canceled || err instanceof CanceledError) throw err
      log(m, "warn", `Analisis konten gagal: ${errMsg(err)} — melanjutkan dengan konteks nama file`)
    }
    m.progress = 90

    // ================= STAGE: METADATA =================
    m.stage = "metadata"
    await db.job.update({ where: { id: jobId }, data: { stage: "metadata", progress: 92 } })
    log(m, "info", "Menyusun judul, caption, hashtag & keyword SEO…")

    let metadata
    try {
      metadata = await generateTikTokMetadata({
        summary,
        clipNames: inputs.map((i) => i.name),
        duration,
        fps: settings.fps,
        aspect: settings.aspect,
      })
      log(m, "ok", `Metadata siap — judul ${metadata.title.length} karakter · ${metadata.hashtags.length} hashtag`)
    } catch (err) {
      if (m.canceled) throw new CanceledError()
      log(m, "warn", `AI metadata gagal: ${errMsg(err)} — memakai template fallback`)
      metadata = fallbackMetadata(
        inputs.map((i) => i.name),
        duration
      )
    }

    // Bersihkan proxy (tidak dipakai lagi)
    await rm(proxyPath, { force: true }).catch(() => undefined)

    m.progress = 100
    await db.job.update({
      where: { id: jobId },
      data: { status: "done", progress: 100, metadataJson: JSON.stringify(metadata) },
    })
    m.finished = true
    log(m, "ok", "✅ Video & metadata siap upload — selamat berkarya!")
  } catch (err) {
    m.finished = true
    if (m.canceled || err instanceof CanceledError) {
      await db.job
        .update({ where: { id: jobId }, data: { status: "canceled", error: null } })
        .catch(() => undefined)
      log(m, "warn", "Proses dibatalkan oleh pengguna.")
    } else {
      const message = errMsg(err).slice(0, 500)
      log(m, "err", `Pipeline gagal: ${message}`)
      await db.job
        .update({ where: { id: jobId }, data: { status: "error", error: message } })
        .catch(() => undefined)
    }
  }
}

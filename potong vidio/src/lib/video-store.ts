import { execFile } from "child_process"
import fs from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"

import type { Job as JobRow, Segment as SegmentRow, Video as VideoRow } from "@prisma/client"

import { db } from "@/lib/db"

export const DATA_DIR = path.join(process.cwd(), "video-data")

export const ALLOWED_EXT = [
  ".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v",
  ".mpg", ".mpeg", ".wmv", ".flv", ".3gp", ".ts", ".mts",
]

export const MAX_AGE_MS = 3 * 60 * 60 * 1000 // 3 jam

export type { JobRow, SegmentRow, VideoRow }

export type JobStatus = "queued" | "processing" | "done" | "error" | "cancelled"
export type JobMode = "fast" | "precise"

// ---- tampilan job untuk klien ----
export interface SegmentClient {
  index: number
  file: string
  startTime: number
  duration: number
  size: number
  url: string
  downloadUrl: string
}

export interface JobClient {
  id: string
  videoId: string
  status: JobStatus
  mode: JobMode
  segmentDuration: number
  rangeStart: number
  rangeEnd: number | null
  audioOnly: boolean
  totalDuration: number
  totalSegments: number
  completedSegments: number
  progress: number
  error?: string
  segments: SegmentClient[]
  createdAt: number
}

export function jobToClient(job: JobRow & { segments?: SegmentRow[] }): JobClient {
  return {
    id: job.id,
    videoId: job.videoId,
    status: job.status as JobStatus,
    mode: job.mode as JobMode,
    segmentDuration: job.segmentDuration,
    rangeStart: job.rangeStart,
    rangeEnd: job.rangeEnd,
    audioOnly: job.audioOnly,
    totalDuration: job.totalDuration,
    totalSegments: job.totalSegments,
    completedSegments: job.completedSegments,
    progress: job.progress,
    error: job.error ?? undefined,
    createdAt: job.createdAt instanceof Date ? job.createdAt.getTime() : Number(job.createdAt),
    segments: (job.segments ?? []).map((s) => ({
      index: s.index,
      file: s.file,
      startTime: s.startTime,
      duration: s.duration,
      size: s.size,
      url: `/api/job/${job.id}/segment/${s.index}`,
      downloadUrl: `/api/job/${job.id}/segment/${s.index}?dl=1`,
    })),
  }
}

// ---- util path ----
export function videoDir(id: string) {
  return path.join(DATA_DIR, id)
}
export function videoInputPath(v: Pick<VideoRow, "id" | "ext">) {
  return path.join(videoDir(v.id), `input${v.ext}`)
}
export function jobDir(videoId: string, jobId: string) {
  return path.join(DATA_DIR, videoId, "jobs", jobId)
}

// ---- util nama file ----
export function baseName(name: string) {
  const base = path.basename(name, path.extname(name))
  return base.replace(/[^\w\-. ]+/g, "_").slice(0, 60) || "video"
}

export function segmentLabel(name: string, index: number, ext = "mp4") {
  return `${baseName(name)}_bagian_${String(index + 1).padStart(3, "0")}.${ext}`
}

export function newId() {
  return randomUUID()
}

// ---- ffprobe helpers ----
function execFileAsync(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(err)
      else resolve({ stdout, stderr })
    })
  })
}

export interface ProbeResult {
  duration: number
  width: number | null
  height: number | null
  hasAudio: boolean
}

export async function probeVideo(file: string): Promise<ProbeResult> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height",
    "-show_entries", "format=duration",
    "-of", "json",
    file,
  ])
  const parsed = JSON.parse(stdout)
  const duration = Number.parseFloat(parsed?.format?.duration ?? "0")
  const streams = Array.isArray(parsed?.streams) ? parsed.streams : []
  const s0 = streams[0] ?? {}
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Durasi video tidak terdeteksi")
  }
  const hasAudio = await hasAudioStream(file)
  return {
    duration,
    width: Number.isFinite(s0.width) ? s0.width : null,
    height: Number.isFinite(s0.height) ? s0.height : null,
    hasAudio,
  }
}

export async function hasAudioStream(file: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-select_streams", "a",
      "-show_entries", "stream=index",
      "-of", "csv=p=0",
      file,
    ])
    return stdout.trim().length > 0
  } catch {
    return false
  }
}

export async function probeDuration(file: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    file,
  ])
  const d = Number.parseFloat(stdout.trim())
  return Number.isFinite(d) ? d : 0
}

// ---- pembersihan data lama (file + baris DB) ----
// Dilindungi mutex sederhana agar tidak dijalankan paralel oleh beberapa request.
// Bila sudah berjalan, pemanggil berikutnya langsung kembali (best-effort).
const cleanupG = globalThis as unknown as { __pvCleanupRunning?: boolean }

export async function cleanupOldData(): Promise<void> {
  if (cleanupG.__pvCleanupRunning) return
  cleanupG.__pvCleanupRunning = true
  try {
    await cleanupOldDataImpl()
  } finally {
    cleanupG.__pvCleanupRunning = false
  }
}

async function cleanupOldDataImpl(): Promise<void> {
  let entries: Awaited<ReturnType<typeof fs.readdir>> = []
  try {
    entries = await fs.readdir(DATA_DIR, { withFileTypes: true })
  } catch {
    return
  }
  const now = Date.now()
  const oldIds: string[] = []
  for (const e of entries) {
    if (!e.isDirectory()) continue
    try {
      const st = await fs.stat(path.join(DATA_DIR, e.name))
      if (now - st.mtimeMs > MAX_AGE_MS) {
        await fs.rm(path.join(DATA_DIR, e.name), { recursive: true, force: true })
        oldIds.push(e.name)
      }
    } catch {
      // abaikan folder bermasalah
    }
  }
  try {
    const vids = await db.video.findMany({ select: { id: true, createdAt: true } })
    for (const v of vids) {
      if (oldIds.includes(v.id)) continue
      const exists = await fs.stat(videoDir(v.id)).then(() => true).catch(() => false)
      if (!exists && now - v.createdAt.getTime() > MAX_AGE_MS) oldIds.push(v.id)
    }
    if (oldIds.length > 0) {
      // hapus job & segment secara berjenjang lewat onDelete: Cascade
      await db.video.deleteMany({ where: { id: { in: oldIds } } })
    }
  } catch {
    // DB belum siap — abaikan
  }
}

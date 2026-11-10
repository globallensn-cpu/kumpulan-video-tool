import { spawn, type ChildProcess } from "child_process"
import fs from "node:fs/promises"
import path from "node:path"

import { db } from "@/lib/db"

import {
  type JobMode,
  type JobRow,
  type VideoRow,
  jobDir,
  probeDuration,
  videoInputPath,
} from "./video-store"

// ---- registry proses & antrean (in-memory, per proses server) ----
const MAX_ACTIVE_JOBS = 2
const PER_JOB_PARALLEL = 2

const g = globalThis as unknown as {
  __pvQueue?: string[]
  __pvActiveJobs?: Set<string>
  __pvProcs?: Map<string, Set<ChildProcess>>
  __pvCancelled?: Set<string>
}

const queue: string[] = g.__pvQueue ?? []
const activeJobs: Set<string> = g.__pvActiveJobs ?? new Set<string>()
const procs: Map<string, Set<ChildProcess>> = g.__pvProcs ?? new Map()
const cancelled: Set<string> = g.__pvCancelled ?? new Set<string>()

g.__pvQueue = queue
g.__pvActiveJobs = activeJobs
g.__pvProcs = procs
g.__pvCancelled = cancelled

function isCancelled(jobId: string) {
  return cancelled.has(jobId)
}

/**
 * Pemulihan job yatim: job yang statusnya masih queued/processing di DB
 * tetapi tidak sedang hidup di proses ini (mis. karena server direstart)
 * ditandai sebagai error agar bisa ditangani pengguna.
 * Dipanggil dari endpoint API; di-throttle agar tidak membebani DB.
 */
const recoveryState = g as unknown as { __pvLastRecovery?: number }
const RECOVERY_THROTTLE_MS = 15_000
const ORPHAN_AGE_MS = 15_000

export function liveJobIds(): string[] {
  return [...activeJobs, ...queue]
}

export async function ensureRecovered(): Promise<void> {
  const now = Date.now()
  const last = recoveryState.__pvLastRecovery ?? 0
  if (now - last < RECOVERY_THROTTLE_MS) return
  recoveryState.__pvLastRecovery = now
  try {
    const live = liveJobIds()
    await db.job.updateMany({
      where: {
        status: { in: ["queued", "processing"] },
        id: live.length > 0 ? { notIn: live } : undefined,
        createdAt: { lt: new Date(now - ORPHAN_AGE_MS) },
      },
      data: {
        status: "error",
        error: "Proses terhenti karena server dimulai ulang. Silakan potong ulang.",
      },
    })
  } catch {
    // DB belum siap — abaikan
  }
}

function trackProc(jobId: string, proc: ChildProcess) {
  let set = procs.get(jobId)
  if (!set) {
    set = new Set()
    procs.set(jobId, set)
  }
  set.add(proc)
  proc.on("close", () => {
    set!.delete(proc)
  })
}

function untrackJob(jobId: string) {
  procs.delete(jobId)
  cancelled.delete(jobId)
}

// ---- wrapper ffmpeg ----
interface RunResult {
  code: number | null
  stderrTail: string
}

// Batas atas mutlak per proses ffmpeg: 30 menit.
// Mencegah proses menggantung selamanya jika ffmpeg macet (rare codec bug, dsb).
const FFMPEG_HARD_TIMEOUT_MS = 30 * 60 * 1000

function runFfmpeg(
  jobId: string | null,
  args: string[],
  onTime?: (sec: number) => void
): Promise<RunResult> {
  return new Promise((resolve) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] })
    if (jobId) trackProc(jobId, proc)
    let tail = ""
    let settled = false

    const hardTimer = setTimeout(() => {
      if (settled) return
      settled = true
      try {
        proc.kill("SIGKILL")
      } catch {
        // proses sudah mati
      }
      resolve({
        code: -1,
        stderrTail: "Proses ffmpeg melebihi batas waktu 30 menit dan dihentikan paksa.",
      })
    }, FFMPEG_HARD_TIMEOUT_MS)

    proc.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString()
      tail = (tail + text).slice(-4000)
      if (onTime) {
        const m = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/g
        let last: number | null = null
        let mm: RegExpExecArray | null
        while ((mm = m.exec(text)) !== null) {
          last = Number(mm[1]) * 3600 + Number(mm[2]) * 60 + Number(mm[3])
        }
        if (last !== null) onTime(last)
      }
    })
    proc.on("error", (err) => {
      if (settled) return
      settled = true
      clearTimeout(hardTimer)
      resolve({ code: -1, stderrTail: `ffmpeg gagal dijalankan: ${err.message}` })
    })
    proc.on("close", (code) => {
      if (settled) return
      settled = true
      clearTimeout(hardTimer)
      resolve({ code, stderrTail: tail })
    })
  })
}

async function setJob(id: string, data: Partial<JobRow>) {
  try {
    await db.job.update({ where: { id }, data })
  } catch {
    // baris sudah terhapus — abaikan
  }
}

// ---- pembuatan job ----
export interface CreateJobOpts {
  segmentDuration: number
  mode: JobMode
  rangeStart?: number
  rangeEnd?: number | null
  audioOnly?: boolean
}

export async function createJob(video: VideoRow, opts: CreateJobOpts): Promise<JobRow> {
  const rangeStart = Math.max(0, opts.rangeStart ?? 0)
  const rangeEnd = opts.rangeEnd ?? null
  const cutDur = Math.max(0.1, (rangeEnd ?? video.duration) - rangeStart)
  const totalSegments = Math.max(1, Math.ceil(cutDur / opts.segmentDuration - 1e-9))

  const job = await db.job.create({
    data: {
      status: "queued",
      mode: opts.mode,
      segmentDuration: opts.segmentDuration,
      rangeStart,
      rangeEnd,
      audioOnly: opts.audioOnly ?? false,
      totalDuration: cutDur,
      totalSegments,
      videoId: video.id,
    },
  })

  queue.push(job.id)
  pumpQueue()
  return job
}

// ---- pembatalan ----
export async function cancelJob(jobId: string): Promise<JobRow | null> {
  const job = await db.job.findUnique({ where: { id: jobId } })
  if (!job) return null
  if (job.status === "done" || job.status === "error" || job.status === "cancelled") {
    return job // idempotent
  }

  cancelled.add(jobId)
  const qi = queue.indexOf(jobId)
  if (qi >= 0) queue.splice(qi, 1)

  for (const p of procs.get(jobId) ?? []) {
    try {
      p.kill("SIGKILL")
    } catch {
      // proses sudah mati
    }
  }

  await setJob(jobId, { status: "cancelled", error: null })
  await fs.rm(jobDir(job.videoId, jobId), { recursive: true, force: true }).catch(() => {})

  const updated = await db.job.findUnique({ where: { id: jobId } })
  return updated ?? job
}

// ---- antrean ----
function pumpQueue() {
  while (activeJobs.size < MAX_ACTIVE_JOBS && queue.length > 0) {
    const jobId = queue.shift()!
    activeJobs.add(jobId)
    void runJob(jobId)
      .catch(async (err) => {
        await setJob(jobId, {
          status: "error",
          error: err instanceof Error ? err.message : "Terjadi kesalahan saat memotong video",
        })
      })
      .finally(() => {
        activeJobs.delete(jobId)
        untrackJob(jobId)
        pumpQueue()
      })
  }
}

// ---- eksekusi satu job ----
async function listSegments(outDir: string, ext: string): Promise<string[]> {
  try {
    const files = await fs.readdir(outDir)
    return files.filter((f) => new RegExp(`^seg_\\d+\\.${ext}$`).test(f)).sort()
  } catch {
    return []
  }
}

async function runJob(jobId: string) {
  const job = await db.job.findUnique({ where: { id: jobId }, include: { video: true } })
  if (!job || job.status !== "queued" || isCancelled(jobId)) return
  await setJob(jobId, { status: "processing" })

  const video = job.video
  const outDir = jobDir(video.id, jobId)
  const input = videoInputPath(video)
  const audioOnly = job.audioOnly
  const ext = audioOnly ? "mp3" : "mp4"
  const rangeStart = job.rangeStart
  const rangeEnd = job.rangeEnd ?? video.duration
  const cutDur = rangeEnd - rangeStart

  try {
    await fs.mkdir(outDir, { recursive: true })

    let lastPct = -1
    const onTime = (sec: number) => {
      if (isCancelled(jobId)) return
      const pct = Math.min(99, Math.round((sec / cutDur) * 100))
      if (pct !== lastPct) {
        lastPct = pct
        void setJob(jobId, { progress: pct })
      }
    }

    if (job.mode === "fast") {
      // Mode cepat: satu proses ffmpeg.
      // -ss sebelum -i: seek cepat ke keyframe (durasi bisa meleset sedikit).
      const args = ["-y", "-ss", rangeStart.toFixed(3), "-i", input, "-t", cutDur.toFixed(3)]
      if (audioOnly) {
        args.push("-vn", "-map", "0:a:0", "-c:a", "libmp3lame", "-b:a", "192k")
      } else {
        args.push("-map", "0:v:0", "-map", "0:a?", "-c", "copy")
      }
      args.push(
        "-f", "segment",
        "-segment_time", String(job.segmentDuration),
        "-reset_timestamps", "1",
        path.join(outDir, `seg_%03d.${ext}`)
      )
      const res = await runFfmpeg(jobId, args, onTime)
      if (isCancelled(jobId)) return
      if (res.code !== 0) {
        await setJob(jobId, {
          status: "error",
          error: `ffmpeg keluar dengan kode ${res.code}. ${res.stderrTail.slice(-300)}`,
        })
        return
      }
    } else {
      // Mode presisi: potong satu per satu dengan re-encode (durasi akurat).
      const total = job.totalSegments
      let completed = 0
      let failed: string | null = null
      let cursorIdx = 0
      let active = 0

      await new Promise<void>((resolve) => {
        const next = () => {
          if (failed || isCancelled(jobId)) {
            if (active === 0) resolve()
            return
          }
          if (cursorIdx >= total && active === 0) {
            resolve()
            return
          }
          while (!failed && !isCancelled(jobId) && active < PER_JOB_PARALLEL && cursorIdx < total) {
            const segIdx = cursorIdx++
            active++
            const start = rangeStart + segIdx * job.segmentDuration
            const dur = Math.min(job.segmentDuration, rangeEnd - start)
            const outFile = path.join(outDir, `seg_${String(segIdx).padStart(3, "0")}.${ext}`)
            const args = ["-y", "-ss", start.toFixed(3), "-i", input, "-t", dur.toFixed(3)]
            if (audioOnly) {
              args.push("-vn", "-map", "0:a:0", "-c:a", "libmp3lame", "-b:a", "192k")
            } else {
              args.push(
                "-map", "0:v:0",
                "-map", "0:a?",
                "-c:v", "libx264",
                "-preset", "veryfast",
                "-crf", "23",
                "-c:a", "aac",
                "-b:a", "128k",
                "-movflags", "+faststart"
              )
            }
            args.push(outFile)
            void runFfmpeg(jobId, args).then((res) => {
              active--
              if (isCancelled(jobId)) {
                if (active === 0) resolve()
                return
              }
              if (res.code !== 0 && !failed) {
                failed = `ffmpeg gagal pada segmen ${segIdx + 1}. ${res.stderrTail.slice(-300)}`
              } else {
                completed++
                void setJob(jobId, {
                  completedSegments: completed,
                  progress: Math.min(99, Math.round((completed / total) * 100)),
                })
              }
              next()
            })
          }
        }
        next()
      })

      if (isCancelled(jobId)) return
      if (failed) {
        await setJob(jobId, { status: "error", error: failed })
        return
      }
    }

    const files = await listSegments(outDir, ext)
    if (files.length === 0) {
      await setJob(jobId, {
        status: "error",
        error: "Tidak ada segmen yang dihasilkan. Format video mungkin tidak didukung.",
      })
      return
    }

    // catat segmen ke DB dengan durasi riil hasil probe;
    // saring file sisa boundary keyframe yang nyaris kosong
    let cursor = rangeStart
    const rows: Array<{
      jobId: string
      index: number
      file: string
      startTime: number
      duration: number
      size: number
    }> = []
    for (const f of files) {
      const full = path.join(outDir, f)
      let dur = 0
      let size = 0
      try {
        const [d, st] = await Promise.all([probeDuration(full), fs.stat(full)])
        dur = d
        size = st.size
      } catch {
        // biarkan 0
      }
      if (dur < 0.15 || size < 2048) {
        await fs.rm(full, { force: true }).catch(() => {})
        continue
      }
      rows.push({ jobId, index: rows.length, file: f, startTime: cursor, duration: dur, size })
      cursor += dur
    }

    if (rows.length === 0) {
      await setJob(jobId, {
        status: "error",
        error: "Tidak ada segmen yang dihasilkan. Format video mungkin tidak didukung.",
      })
      return
    }

    await db.segment.createMany({ data: rows })
    await setJob(jobId, {
      status: "done",
      totalSegments: rows.length,
      completedSegments: rows.length,
      progress: 100,
    })
  } catch (err) {
    if (!isCancelled(jobId)) {
      await setJob(jobId, {
        status: "error",
        error: err instanceof Error ? err.message : "Terjadi kesalahan saat memotong video",
      })
    }
  }
}

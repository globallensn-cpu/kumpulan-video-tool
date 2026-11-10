// ============================================================
// TokForge — Pembungkus FFmpeg 7
// - probeVideo      : baca metadata via ffprobe
// - makeThumbnail   : ekstrak 1 frame jadi JPG
// - runFfmpeg       : spawn + parsing progress realtime
// - buildMergeArgs  : one-pass merge (filter_complex concat)
//   → semua klip dinormalisasi (scale/pad/blur, fps, SAR, audio)
//     lalu digabung & di-encode SEKALI (single-generation,
//     kualitas terbaik — pola industri merge China/剪映)
// ============================================================

import { execFile, spawn } from "child_process"
import { promisify } from "util"
import { AUDIO_SAMPLE_RATE, QUALITY_PRESETS, TARGET_HEIGHT, TARGET_WIDTH, TIMESCALE } from "./tiktok-specs"
import type { JobSettings } from "./types"

const execFileAsync = promisify(execFile)

// ------------------------------------------------------------
// Probe
// ------------------------------------------------------------

export interface ProbeResult {
  duration: number
  videoDuration: number
  width: number
  height: number
  fps: number
  codec: string
  hasAudio: boolean
  audioCodec: string | null
  bitrate: number
}

export async function probeVideo(filePath: string): Promise<ProbeResult> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    filePath,
  ])
  const data = JSON.parse(stdout) as {
    streams?: Array<Record<string, unknown>>
    format?: Record<string, unknown>
  }
  const streams = data.streams ?? []
  const video = streams.find((s) => s.codec_type === "video")
  const audio = streams.find((s) => s.codec_type === "audio")
  if (!video) throw new Error("File tidak mengandung stream video yang valid.")

  const rate = String(video.r_frame_rate ?? "30/1").split("/")
  const num = Number(rate[0]) || 30
  const den = Number(rate[1]) || 1
  const containerDuration = Number(data.format?.duration ?? 0) || 0
  const streamDuration = Number(video.duration ?? 0) || 0

  return {
    duration: Math.max(containerDuration, streamDuration),
    videoDuration: streamDuration || containerDuration,
    width: Number(video.width ?? 0),
    height: Number(video.height ?? 0),
    fps: den > 0 ? num / den : 30,
    codec: String(video.codec_name ?? "unknown"),
    hasAudio: Boolean(audio),
    audioCodec: audio ? String(audio.codec_name ?? "unknown") : null,
    bitrate: Number(data.format?.bit_rate ?? 0) || 0,
  }
}

// ------------------------------------------------------------
// Thumbnail
// ------------------------------------------------------------

export async function makeThumbnail(input: string, output: string, duration: number): Promise<void> {
  const seek = Math.min(1, Math.max(duration / 2, 0))
  await execFileAsync("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    String(seek),
    "-i",
    input,
    "-frames:v",
    "1",
    "-vf",
    "scale=320:-2",
    "-q:v",
    "4",
    output,
  ])
}

// ------------------------------------------------------------
// Runner dengan progress realtime
// ------------------------------------------------------------

export interface FfmpegHandle {
  promise: Promise<void>
  kill: () => void
}

export function runFfmpeg(
  args: string[],
  opts?: {
    totalDuration?: number
    onProgress?: (fraction: number) => void
    /** Hard-stop proses bila menggantung lebih lama dari ini (ms) */
    timeoutMs?: number
  }
): FfmpegHandle {
  const proc = spawn("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-progress",
    "pipe:1",
    "-nostats",
    ...args,
  ])

  let stderr = ""
  let outTimeUs = 0
  let lastFraction = -1
  let pending = ""

  proc.stdout.on("data", (chunk: Buffer) => {
    pending += chunk.toString()
    const lines = pending.split("\n")
    pending = lines.pop() ?? ""
    for (const line of lines) {
      const eq = line.indexOf("=")
      if (eq < 0) continue
      const key = line.slice(0, eq).trim()
      const value = line.slice(eq + 1).trim()
      if (value === "N/A") continue
      if (key === "out_time_us") outTimeUs = Number(value) || 0
      else if (key === "out_time_ms" && outTimeUs === 0) outTimeUs = Number(value) || 0
    }
    const total = opts?.totalDuration ?? 0
    if (opts?.onProgress && total > 0) {
      const f = Math.min(0.995, Math.max(0, outTimeUs / (total * 1e6)))
      if (f > lastFraction) {
        lastFraction = f
        opts.onProgress(f)
      }
    }
  })

  proc.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString()
    if (stderr.length > 8000) stderr = stderr.slice(-8000)
  })

  // Hard-stop bila proses menggantung (file korup / disk penuh / bug filter)
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null
  if (opts?.timeoutMs && opts.timeoutMs > 0) {
    timeoutTimer = setTimeout(() => {
      stderr += `\n[batas-waktu] ffmpeg melebihi ${Math.round(opts.timeoutMs! / 1000)} detik — proses dihentikan paksa.`
      try {
        proc.kill("SIGKILL")
      } catch {
        // proses sudah mati — abaikan
      }
    }, opts.timeoutMs)
  }

  const promise = new Promise<void>((resolve, reject) => {
    proc.on("error", (err) => {
      if (timeoutTimer) clearTimeout(timeoutTimer)
      reject(err)
    })
    proc.on("close", (code) => {
      if (timeoutTimer) clearTimeout(timeoutTimer)
      if (code === 0) {
        resolve()
      } else {
        const tail = stderr.trim().split("\n").slice(-3).join("\n")
        reject(new Error(tail || `ffmpeg keluar dengan kode ${code ?? "null"}`))
      }
    })
  })

  return {
    promise,
    kill: () => {
      try {
        proc.kill("SIGKILL")
      } catch {
        // proses sudah mati — abaikan
      }
    },
  }
}

// ------------------------------------------------------------
// Argumen merge one-pass
// ------------------------------------------------------------

export interface MergeInput {
  path: string
  duration: number
  hasAudio: boolean
  name: string
}

export function buildMergeArgs(inputs: MergeInput[], settings: JobSettings, outputPath: string): string[] {
  const W = TARGET_WIDTH
  const H = TARGET_HEIGHT
  const fps = settings.fps
  const chains: string[] = []

  inputs.forEach((clip, i) => {
    const dur = Math.max(clip.duration, 0.05).toFixed(3)

    // --- Rantai video: normalisasi ke 1080x1920 sesuai mode aspek ---
    let vf: string
    if (settings.aspect === "crop") {
      vf = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1`
    } else if (settings.aspect === "fit") {
      vf =
        `scale=${W}:${H}:force_original_aspect_ratio=decrease,` +
        `scale=trunc(iw/2)*2:trunc(ih/2)*2,` +
        `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1`
    } else {
      // blur: latar blur murah (downscale langsung → gblur → upscale) ala CapCut
      vf =
        `split=2[bg${i}][fg${i}];` +
        `[bg${i}]scale=216:384:force_original_aspect_ratio=increase,crop=216:384,gblur=sigma=10,` +
        `scale=${W}:${H},eq=brightness=-0.06[bgx${i}];` +
        `[fg${i}]scale=${W}:${H}:force_original_aspect_ratio=decrease[fgx${i}];` +
        `[bgx${i}][fgx${i}]overlay=(W-w)/2:(H-h)/2,setsar=1`
    }

    chains.push(
      `[${i}:v]${vf},fps=${fps},trim=0:${dur},setpts=N/(FRAME_RATE*TB),format=yuv420p[v${i}]`
    )

    // --- Rantai audio: samakan samplerate/layout, pad & trim presisi ---
    if (clip.hasAudio) {
      chains.push(
        `[${i}:a]aresample=${AUDIO_SAMPLE_RATE},aformat=sample_fmts=fltp:channel_layouts=stereo,` +
          `apad,atrim=0:${dur},asetpts=N/SR/TB[a${i}]`
      )
    } else {
      chains.push(
        `aevalsrc=0:d=${dur}:s=${AUDIO_SAMPLE_RATE},aformat=sample_fmts=fltp:channel_layouts=stereo[a${i}]`
      )
    }
  })

  // CATATAN: concat filter mengonsumsi input per-segmen (video lalu audio),
  // jadi urutannya harus diinterleave: [v0][a0][v1][a1]…
  const concatInputs = inputs.map((_, i) => `[v${i}][a${i}]`).join("")

  const filterComplex =
    [...chains, `${concatInputs}concat=n=${inputs.length}:v=1:a=1[vout][aout]`].join(";")

  const q = QUALITY_PRESETS[settings.quality]
  const gop = fps * 2

  return [
    ...inputs.flatMap((c) => ["-i", c.path]),
    "-filter_complex",
    filterComplex,
    "-map",
    "[vout]",
    "-map",
    "[aout]",
    "-c:v",
    "libx264",
    "-profile:v",
    "high",
    "-level",
    "4.1",
    "-preset",
    q.preset,
    "-crf",
    String(q.crf),
    "-maxrate",
    q.maxrate,
    "-bufsize",
    q.bufsize,
    "-pix_fmt",
    "yuv420p",
    "-g",
    String(gop),
    "-keyint_min",
    String(gop),
    "-sc_threshold",
    "0",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-ar",
    String(AUDIO_SAMPLE_RATE),
    "-ac",
    "2",
    "-video_track_timescale",
    String(TIMESCALE),
    "-movflags",
    "+faststart",
    outputPath,
  ]
}

// ------------------------------------------------------------
// Proxy ringan untuk analisis AI (480p · tanpa audio)
// Frame dibatasi ±180 total (fps adaptif) agar payload AI
// tetap ringan untuk video panjang hingga 10 menit.
// ------------------------------------------------------------

export function buildProxyArgs(input: string, output: string, durationSec: number): string[] {
  const fps = Math.min(2, Math.max(0.25, 180 / Math.max(durationSec, 1)))
  return [
    "-i",
    input,
    "-vf",
    `fps=${fps.toFixed(3)},scale=480:-2`,
    "-an",
    "-c:v",
    "libx264",
    "-crf",
    "35",
    "-preset",
    "veryfast",
    "-pix_fmt",
    "yuv420p",
    output,
  ]
}

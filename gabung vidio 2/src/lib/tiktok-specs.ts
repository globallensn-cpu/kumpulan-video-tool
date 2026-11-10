// ============================================================
// TokForge — Konstanta spesifikasi encode hasil riset
// Sumber: TikTok Help / panduan bitrate 2025 (5 Mbps sweet-spot
// 1080p@30, 8–12 Mbps HQ), Douyin/抖音 (1080P 30/60fps), pola
// ekspor CapCut/剪映 (timescale 15360, faststart), praktek
// industri FFmpeg (normalize → concat → single-generation encode)
// ============================================================

import type { AspectMode, JobSettings, QualityMode } from "./types"

export const TARGET_WIDTH = 1080
export const TARGET_HEIGHT = 1920
export const AUDIO_SAMPLE_RATE = 44100
export const AUDIO_BITRATE = "128k"
/** Timescale track video ala CapCut/剪映 untuk kompatibilitas maksimal */
export const TIMESCALE = 15360

export interface QualityPreset {
  key: QualityMode
  label: string
  desc: string
  preset: string
  crf: number
  maxrate: string
  bufsize: string
}

export const QUALITY_PRESETS: Record<QualityMode, QualityPreset> = {
  balanced: {
    key: "balanced",
    label: "Seimbang",
    desc: "±5–6 Mbps · file ramping",
    preset: "veryfast",
    crf: 23,
    maxrate: "6M",
    bufsize: "9M",
  },
  high: {
    key: "high",
    label: "Tinggi",
    desc: "±8–10 Mbps · rekomendasi riset",
    preset: "fast",
    crf: 20,
    maxrate: "10M",
    bufsize: "15M",
  },
  ultra: {
    key: "ultra",
    label: "Ultra",
    desc: "±12–15 Mbps · kualitas maksimal",
    preset: "medium",
    crf: 18,
    maxrate: "15M",
    bufsize: "22M",
  },
}

export const MAX_FILE_BYTES = 500 * 1024 * 1024
export const MAX_CLIPS = 20
export const ALLOWED_EXT = ["mp4", "mov", "webm", "mkv", "avi", "m4v", "3gp"]

export const ASPECT_OPTIONS: { value: AspectMode; title: string; desc: string }[] = [
  {
    value: "blur",
    title: "Blur Background",
    desc: "Video dipusatkan, latar blur estetik — gaya CapCut/剪映",
  },
  {
    value: "crop",
    title: "Crop Fill",
    desc: "Penuh layar 9:16, tepi otomatis terpotong",
  },
  {
    value: "fit",
    title: "Fit Letterbox",
    desc: "Seluruh frame utuh, batang hitam atas-bawah",
  },
]

export const DEFAULT_SETTINGS: JobSettings = {
  aspect: "blur",
  fps: 30,
  quality: "high",
}

/** Fakta riset algoritma TikTok — ditampilkan di UI sidebar */
export const ALGORITHM_FACTS: { title: string; detail: string }[] = [
  {
    title: "3 detik pertama = hook",
    detail:
      "Watch time di detik-detik awal adalah sinyal ranking terkuat — judul & opening harus langsung menarik.",
  },
  {
    title: "Completion rate > 70%",
    detail:
      "Video yang ditonton sampai habis di-boost di FYP & pencarian TikTok — durasi ideal 15–60 detik.",
  },
  {
    title: "Keyword di 3 tempat",
    detail:
      "TikTok membaca caption (NLP), teks di layar (OCR), dan audio yang diucapkan (ASR).",
  },
  {
    title: "3–6 hashtag relevan",
    detail:
      "Campuran broad + niche yang benar-benar sesuai konten. Hindari tag generik seperti #fyp / #viral.",
  },
]

/** Spesifikasi encode aktif — untuk kartu transparansi di UI */
export function activeSpecRows(settings: JobSettings) {
  const q = QUALITY_PRESETS[settings.quality]
  return [
    { label: "Resolusi", value: `${TARGET_WIDTH}×${TARGET_HEIGHT} · 9:16 vertikal` },
    { label: "Video", value: "H.264 High @ L4.1 (libx264)" },
    { label: "Audio", value: `AAC 128kbps · ${AUDIO_SAMPLE_RATE / 1000}kHz stereo` },
    { label: "Bitrate maks", value: `${q.maxrate.replace("M", " Mbps")} · CRF ${q.crf}` },
    { label: "Frame rate", value: `${settings.fps} fps · GOP 2 detik` },
    { label: "Container", value: "MP4 · +faststart · timescale 15360" },
  ]
}

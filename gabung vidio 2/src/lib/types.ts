// ============================================================
// TokForge — Kontrak tipe data bersama frontend & backend
// ============================================================

export type AspectMode = "blur" | "crop" | "fit"
export type QualityMode = "balanced" | "high" | "ultra"
export type FpsMode = 30 | 60

export interface JobSettings {
  aspect: AspectMode
  fps: FpsMode
  quality: QualityMode
}

export interface ClipDTO {
  id: string
  originalName: string
  duration: number
  width: number
  height: number
  fps: number
  size: number
  codec: string
  hasAudio: boolean
  thumbUrl: string
  createdAt: string
}

export type JobStatus = "queued" | "processing" | "done" | "error" | "canceled"
export type JobStage = "prepare" | "encode" | "analyze" | "metadata"

export type LogLevel = "info" | "cmd" | "ok" | "warn" | "err"

export interface LogEntry {
  t: number
  level: LogLevel
  msg: string
}

export interface OutputSpecs {
  duration: number
  size: number
  bitrateKbps: number
  width: number
  height: number
  fps: number
}

export interface TikTokMetadata {
  title: string
  caption: string
  hashtags: string[]
  keywords: string[]
  overlays: string[]
  seoTips: string[]
  seoScore: number
}

/** State job yang hidup di memori (di-update realtime oleh pipeline) */
export interface JobMemoryState {
  stage: JobStage
  progress: number
  logs: LogEntry[]
}

export interface JobDTO {
  id: string
  status: JobStatus
  stage: JobStage
  progress: number
  logs: LogEntry[]
  error?: string
  videoUrl?: string
  downloadUrl?: string
  specs?: OutputSpecs
  contentSummary?: string
  metadata?: TikTokMetadata
  settings?: JobSettings
  clipCount?: number
  createdAt: string
}

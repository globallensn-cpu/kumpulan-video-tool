// ============================================================
// TokForge — Mapper database → DTO (kontrak API)
// ============================================================

import type { Clip, Job } from "@prisma/client"
import type {
  ClipDTO,
  JobDTO,
  JobMemoryState,
  JobSettings,
  JobStage,
  JobStatus,
  OutputSpecs,
  TikTokMetadata,
} from "./types"
import { DEFAULT_SETTINGS } from "./tiktok-specs"

function safeParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function toClipDTO(clip: Clip): ClipDTO {
  return {
    id: clip.id,
    originalName: clip.originalName,
    duration: clip.duration,
    width: clip.width,
    height: clip.height,
    fps: clip.fps,
    size: clip.size,
    codec: clip.codec,
    hasAudio: clip.hasAudio,
    thumbUrl: `/api/clips/${clip.id}/thumb`,
    createdAt: clip.createdAt.toISOString(),
  }
}

export function toJobDTO(job: Job, mem?: JobMemoryState): JobDTO {
  const settings = safeParse<JobSettings>(job.settingsJson, DEFAULT_SETTINGS)
  const specs = safeParse<OutputSpecs | undefined>(job.specsJson, undefined)
  const metadata = safeParse<TikTokMetadata | undefined>(job.metadataJson, undefined)
  const done = job.status === "done" && Boolean(job.videoFilename)

  return {
    id: job.id,
    status: job.status as JobStatus,
    stage: (mem?.stage ?? job.stage) as JobStage,
    progress: Math.round(mem?.progress ?? job.progress),
    logs: mem?.logs ?? [],
    error: job.error ?? undefined,
    videoUrl: done ? `/api/jobs/${job.id}/video` : undefined,
    downloadUrl: done ? `/api/jobs/${job.id}/video?download=1` : undefined,
    specs,
    metadata,
    contentSummary: job.contentSummary ?? undefined,
    settings,
    clipCount: job.clipCount,
    createdAt: job.createdAt.toISOString(),
  }
}

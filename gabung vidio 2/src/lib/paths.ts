// ============================================================
// TokForge — Manajemen path penyimpanan file (storage/)
// ============================================================

import path from "path"
import { mkdir } from "fs/promises"

const ROOT = process.cwd()

export const STORAGE_ROOT = path.join(ROOT, "storage")
export const CLIPS_DIR = path.join(STORAGE_ROOT, "clips")
export const THUMBS_DIR = path.join(STORAGE_ROOT, "thumbs")
export const JOBS_DIR = path.join(STORAGE_ROOT, "jobs")

export async function ensureDirs(): Promise<void> {
  await mkdir(CLIPS_DIR, { recursive: true })
  await mkdir(THUMBS_DIR, { recursive: true })
  await mkdir(JOBS_DIR, { recursive: true })
}

export function clipPath(filename: string): string {
  return path.join(CLIPS_DIR, filename)
}

export function thumbPath(id: string): string {
  return path.join(THUMBS_DIR, `${id}.jpg`)
}

export function jobDir(jobId: string): string {
  return path.join(JOBS_DIR, jobId)
}

/** Validasi format ID (UUID/cuid) — blok karakter berbahaya via parameter URL */
const SAFE_ID_RE = /^[A-Za-z0-9_-]{6,64}$/

export function isSafeId(id: string): boolean {
  return SAFE_ID_RE.test(id)
}

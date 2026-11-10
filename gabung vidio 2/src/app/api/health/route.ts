// GET /api/health — cek kesehatan lingkungan (database + binary FFmpeg).
// Dipakai frontend saat load untuk memperingatkan dulu sebelum user upload.

import { NextResponse } from "next/server"
import { execFile } from "child_process"
import { promisify } from "util"
import { db } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const execFileAsync = promisify(execFile)

// Cache hasil cek binary 60 detik — jangan spawn proses tiap polling
let binCache: { ffmpeg: boolean; ffprobe: boolean; at: number } | null = null

async function checkBinaries(): Promise<{ ffmpeg: boolean; ffprobe: boolean }> {
  if (binCache && Date.now() - binCache.at < 60_000) {
    return { ffmpeg: binCache.ffmpeg, ffprobe: binCache.ffprobe }
  }
  const [ffmpeg, ffprobe] = await Promise.all([
    execFileAsync("ffmpeg", ["-version"]).then(() => true).catch(() => false),
    execFileAsync("ffprobe", ["-version"]).then(() => true).catch(() => false),
  ])
  binCache = { ffmpeg, ffprobe, at: Date.now() }
  return { ffmpeg, ffprobe }
}

export async function GET() {
  let dbOk = true
  try {
    await db.$queryRaw`SELECT 1`
  } catch {
    dbOk = false
  }

  let bins = { ffmpeg: false, ffprobe: false }
  try {
    bins = await checkBinaries()
  } catch {
    // tetap false
  }

  const ok = dbOk && bins.ffmpeg && bins.ffprobe
  return NextResponse.json(
    {
      ok,
      db: dbOk,
      ffmpeg: bins.ffmpeg,
      ffprobe: bins.ffprobe,
      time: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  )
}

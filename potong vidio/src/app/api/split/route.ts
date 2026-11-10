import { NextRequest, NextResponse } from "next/server"

import { db } from "@/lib/db"
import { createJob, ensureRecovered } from "@/lib/splitter"
import {
  type JobMode,
  cleanupOldData,
  jobToClient,
} from "@/lib/video-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  await ensureRecovered()
  await cleanupOldData().catch(() => {})

  let body: {
    videoId?: string
    segmentDuration?: number
    mode?: string
    rangeStart?: number
    rangeEnd?: number | null
    audioOnly?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Body harus JSON valid." }, { status: 400 })
  }

  const videoId = typeof body.videoId === "string" ? body.videoId : ""
  const video = await db.video.findUnique({ where: { id: videoId } })
  if (!video) {
    return NextResponse.json(
      { ok: false, error: "Video tidak ditemukan atau sudah kedaluwarsa. Silakan unggah ulang." },
      { status: 404 }
    )
  }

  const segDur = Number(body.segmentDuration)
  if (!Number.isFinite(segDur) || segDur < 1 || segDur > 600) {
    return NextResponse.json(
      { ok: false, error: "Durasi per potongan harus antara 1 sampai 600 detik." },
      { status: 400 }
    )
  }

  // validasi rentang kustom
  let rangeStart = 0
  let rangeEnd: number | null = null
  if (typeof body.rangeStart === "number" || typeof body.rangeEnd === "number") {
    rangeStart = Math.max(0, Number(body.rangeStart) || 0)
    if (typeof body.rangeEnd === "number" && Number.isFinite(body.rangeEnd)) {
      if (body.rangeEnd <= rangeStart) {
        return NextResponse.json(
          { ok: false, error: "Akhir rentang harus lebih besar dari awal rentang." },
          { status: 400 }
        )
      }
      rangeEnd = Math.min(body.rangeEnd, video.duration)
    }
    if (rangeStart >= video.duration - 0.05) {
      return NextResponse.json(
        { ok: false, error: "Awal rentang melebihi atau hampir sama dengan durasi video." },
        { status: 400 }
      )
    }
  }

  const audioOnly = body.audioOnly === true
  if (audioOnly && !video.hasAudio) {
    return NextResponse.json(
      { ok: false, error: "Video ini tidak memiliki trek audio, tidak bisa diekstrak ke MP3." },
      { status: 400 }
    )
  }

  const mode: JobMode = body.mode === "precise" ? "precise" : "fast"

  const job = await createJob(video, {
    segmentDuration: Math.round(segDur),
    mode,
    rangeStart,
    rangeEnd,
    audioOnly,
  })

  return NextResponse.json({ ok: true, job: jobToClient(job) })
}

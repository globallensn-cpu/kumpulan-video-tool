import path from "node:path"

import { NextRequest } from "next/server"

import { db } from "@/lib/db"
import { ensureRecovered } from "@/lib/splitter"
import { streamVideoFile } from "@/lib/stream-file"
import { jobDir, segmentLabel } from "@/lib/video-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; index: string }> }
) {
  await ensureRecovered()
  const { id, index } = await params
  const job = await db.job.findUnique({
    where: { id },
    include: { video: true, segments: true },
  })
  if (!job) {
    return Response.json({ ok: false, error: "Pekerjaan tidak ditemukan." }, { status: 404 })
  }
  const idx = Number(index)
  const seg = job.segments.find((s) => s.index === idx)
  if (!seg) {
    return Response.json({ ok: false, error: "Segmen tidak ditemukan." }, { status: 404 })
  }

  const filePath = path.join(jobDir(job.videoId, job.id), seg.file)
  const label = segmentLabel(
    job.video.originalName,
    idx,
    job.audioOnly ? "mp3" : "mp4"
  )
  const download = req.nextUrl.searchParams.get("dl") === "1"

  return streamVideoFile(req, filePath, {
    filename: label,
    download,
    contentType: job.audioOnly ? "audio/mpeg" : "video/mp4",
  })
}

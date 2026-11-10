import path from "node:path"

import { NextRequest } from "next/server"

import { db } from "@/lib/db"
import { ensureRecovered } from "@/lib/splitter"
import { streamVideoFile } from "@/lib/stream-file"
import { videoDir } from "@/lib/video-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureRecovered()
  const { id } = await params
  const video = await db.video.findUnique({ where: { id } })
  if (!video) {
    return Response.json({ ok: false, error: "Video tidak ditemukan." }, { status: 404 })
  }
  const filePath = path.join(videoDir(id), `input${video.ext}`)
  return streamVideoFile(req, filePath, { filename: video.originalName })
}

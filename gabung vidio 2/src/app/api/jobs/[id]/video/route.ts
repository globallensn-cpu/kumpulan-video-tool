// GET /api/jobs/[id]/video — stream video final (dukungan Range untuk player,
// ?download=1 untuk unduhan dengan nama file SEO-friendly dari judul)

import { NextResponse } from "next/server"
import { createReadStream } from "fs"
import { stat } from "fs/promises"
import { Readable } from "stream"
import path from "path"
import { db } from "@/lib/db"
import { isSafeId, jobDir } from "@/lib/paths"
import { slugify } from "@/lib/format"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!isSafeId(id)) return new NextResponse("ID tidak valid", { status: 404 })
    const job = await db.job.findUnique({ where: { id } })
    if (!job?.videoFilename) {
      return new NextResponse("Video tidak ditemukan", { status: 404 })
    }

    const filePath = path.join(jobDir(id), job.videoFilename)
    let fileStat
    try {
      fileStat = await stat(filePath)
    } catch {
      return new NextResponse("File video tidak tersedia", { status: 404 })
    }

    // Nama file unduhan dari judul SEO
    let downloadName = "tokforge-video.mp4"
    if (job.metadataJson) {
      try {
        const meta = JSON.parse(job.metadataJson) as { title?: string }
        const slug = meta.title ? slugify(meta.title) : ""
        if (slug) downloadName = `TokForge - ${slug}.mp4`
      } catch {
        // biarkan nama default
      }
    }
    const isDownload = new URL(req.url).searchParams.get("download") === "1"
    const disposition: Record<string, string> = isDownload
      ? { "Content-Disposition": `attachment; filename="${downloadName}"` }
      : {}

    const range = req.headers.get("range")
    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range)
      const size = fileStat.size
      let start = match?.[1] ? parseInt(match[1], 10) : 0
      let end = match?.[2] ? parseInt(match[2], 10) : size - 1
      if (Number.isNaN(start) || start < 0) start = 0
      if (Number.isNaN(end) || end >= size) end = size - 1
      if (start > end || start >= size) {
        return new NextResponse(null, { status: 416 })
      }
      const stream = createReadStream(filePath, { start, end })
      return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
        status: 206,
        headers: {
          "Content-Type": "video/mp4",
          "Content-Length": String(end - start + 1),
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Accept-Ranges": "bytes",
          "X-Content-Type-Options": "nosniff",
          ...disposition,
        },
      })
    }

    const stream = createReadStream(filePath)
    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(fileStat.size),
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        ...disposition,
      },
    })
  } catch {
    return new NextResponse("Gagal memuat video", { status: 500 })
  }
}

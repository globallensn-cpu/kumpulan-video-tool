// GET /api/clips/[id]/thumb — thumbnail JPG klip (regenerasi otomatis bila hilang)

import { NextResponse } from "next/server"
import { readFile, stat } from "fs/promises"
import { db } from "@/lib/db"
import { makeThumbnail } from "@/lib/ffmpeg"
import { clipPath, isSafeId, thumbPath } from "@/lib/paths"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!isSafeId(id)) return new NextResponse("ID tidak valid", { status: 404 })
    const clip = await db.clip.findUnique({ where: { id } })
    if (!clip) return new NextResponse("Klip tidak ditemukan", { status: 404 })

    const tp = thumbPath(id)
    try {
      await stat(tp)
    } catch {
      // Thumbnail hilang — regenerasi dari file sumber
      try {
        await makeThumbnail(clipPath(clip.filename), tp, clip.duration)
      } catch {
        return new NextResponse("Thumbnail tidak tersedia", { status: 404 })
      }
    }

    const data = await readFile(tp)
    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch {
    return new NextResponse("Gagal memuat thumbnail", { status: 500 })
  }
}

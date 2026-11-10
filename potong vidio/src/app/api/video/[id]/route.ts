import { NextRequest, NextResponse } from "next/server"

import { db } from "@/lib/db"
import { ensureRecovered } from "@/lib/splitter"
import { cleanupOldData, jobToClient } from "@/lib/video-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Meta video + daftar pekerjaannya — dipakai untuk memulihkan sesi
 * setelah halaman di-refresh.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureRecovered()
  await cleanupOldData().catch(() => {})

  const { id } = await params
  const video = await db.video.findUnique({
    where: { id },
    include: {
      jobs: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { segments: { orderBy: { index: "asc" } } },
      },
    },
  })
  if (!video) {
    return NextResponse.json(
      { ok: false, error: "Video tidak ditemukan atau sudah kedaluwarsa." },
      { status: 404 }
    )
  }

  return NextResponse.json({
    ok: true,
    video: {
      id: video.id,
      originalName: video.originalName,
      size: video.size,
      duration: video.duration,
      width: video.width,
      height: video.height,
      hasAudio: video.hasAudio,
    },
    jobs: video.jobs.map(jobToClient),
  })
}

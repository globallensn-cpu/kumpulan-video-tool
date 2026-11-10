// GET /api/clips — daftar pool klip (urutan unggah)

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { toClipDTO } from "@/lib/dto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const clips = await db.clip.findMany({ orderBy: { createdAt: "asc" } })
    return NextResponse.json({ clips: clips.map(toClipDTO) })
  } catch {
    return NextResponse.json({ clips: [] })
  }
}

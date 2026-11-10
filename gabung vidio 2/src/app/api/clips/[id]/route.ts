// DELETE /api/clips/[id] — hapus klip (file + thumbnail + record)

import { NextResponse } from "next/server"
import { rm } from "fs/promises"
import { db } from "@/lib/db"
import { clipPath, isSafeId, thumbPath } from "@/lib/paths"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!isSafeId(id)) {
      return NextResponse.json({ error: "ID klip tidak valid." }, { status: 404 })
    }
    const clip = await db.clip.findUnique({ where: { id } })
    if (clip) {
      await rm(clipPath(clip.filename), { force: true }).catch(() => undefined)
      await rm(thumbPath(id), { force: true }).catch(() => undefined)
      await db.clip.delete({ where: { id } }).catch(() => undefined)
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Gagal menghapus klip." }, { status: 500 })
  }
}

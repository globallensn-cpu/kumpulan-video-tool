// DELETE /api/jobs/[id] — buang job (batalkan bila jalan, hapus file & record)

import { NextResponse } from "next/server"
import { rm } from "fs/promises"
import { db } from "@/lib/db"
import { isSafeId, jobDir } from "@/lib/paths"
import { cancelJob, dropMemory } from "@/lib/pipeline"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!isSafeId(id)) {
      return NextResponse.json({ error: "ID job tidak valid." }, { status: 404 })
    }
    const job = await db.job.findUnique({ where: { id } })
    cancelJob(id)
    dropMemory(id)
    if (job) {
      await rm(jobDir(id), { recursive: true, force: true }).catch(() => undefined)
      await db.job.delete({ where: { id } }).catch(() => undefined)
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Gagal menghapus job." }, { status: 500 })
  }
}

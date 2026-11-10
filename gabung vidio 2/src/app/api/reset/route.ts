// DELETE /api/reset — bersihkan seluruh studio (klip + job + file) untuk batch baru

import { NextResponse } from "next/server"
import { rm } from "fs/promises"
import { db } from "@/lib/db"
import { CLIPS_DIR, JOBS_DIR, THUMBS_DIR, ensureDirs } from "@/lib/paths"
import { cancelJob, clearMemory, dropMemory } from "@/lib/pipeline"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function DELETE() {
  try {
    const jobs = await db.job.findMany({ select: { id: true } })
    for (const j of jobs) {
      cancelJob(j.id)
      dropMemory(j.id)
    }
    clearMemory()
    await rm(JOBS_DIR, { recursive: true, force: true }).catch(() => undefined)
    await rm(CLIPS_DIR, { recursive: true, force: true }).catch(() => undefined)
    await rm(THUMBS_DIR, { recursive: true, force: true }).catch(() => undefined)
    await ensureDirs()
    await db.job.deleteMany()
    await db.clip.deleteMany()
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Gagal mereset studio." }, { status: 500 })
  }
}

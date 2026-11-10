// GET /api/jobs/active — status job terbaru (untuk polling realtime)

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { toJobDTO } from "@/lib/dto"
import { getMemory } from "@/lib/pipeline"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const job = await db.job.findFirst({ orderBy: { createdAt: "desc" } })
    if (!job) return NextResponse.json({ job: null })

    const memState = getMemory(job.id)

    // Deteksi job basi (server reload di tengah proses)
    if (job.status === "processing" && !memState) {
      const error = "Proses terhenti karena server dimuat ulang. Silakan jalankan ulang pipeline."
      await db.job.update({ where: { id: job.id }, data: { status: "error", error } }).catch(() => undefined)
      return NextResponse.json({ job: toJobDTO({ ...job, status: "error", error }) })
    }

    return NextResponse.json({ job: toJobDTO(job, memState ?? undefined) })
  } catch {
    return NextResponse.json({ job: null })
  }
}

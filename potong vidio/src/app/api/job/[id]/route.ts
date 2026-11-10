import { NextRequest, NextResponse } from "next/server"

import { db } from "@/lib/db"
import { ensureRecovered } from "@/lib/splitter"
import { jobToClient } from "@/lib/video-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureRecovered()
  const { id } = await params
  const job = await db.job.findUnique({
    where: { id },
    include: { segments: { orderBy: { index: "asc" } } },
  })
  if (!job) {
    return NextResponse.json({ ok: false, error: "Pekerjaan tidak ditemukan." }, { status: 404 })
  }
  return NextResponse.json({ ok: true, job: jobToClient(job) })
}

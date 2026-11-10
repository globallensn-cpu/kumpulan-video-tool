// POST /api/jobs/[id]/cancel — batalkan pipeline yang berjalan

import { NextResponse } from "next/server"
import { isSafeId } from "@/lib/paths"
import { cancelJob } from "@/lib/pipeline"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!isSafeId(id)) {
      return NextResponse.json({ ok: false, error: "ID job tidak valid." }, { status: 404 })
    }
    const ok = cancelJob(id)
    return NextResponse.json({ ok })
  } catch {
    return NextResponse.json({ error: "Gagal membatalkan." }, { status: 500 })
  }
}

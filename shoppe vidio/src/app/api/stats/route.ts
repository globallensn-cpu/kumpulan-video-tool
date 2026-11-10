import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [successCount, downloadCount] = await Promise.all([
      db.extractionLog.count({ where: { ok: true, source: { in: ["shopee", "demo"] } } }),
      db.extractionLog.count({ where: { source: "download", ok: true } }),
    ]);
    return NextResponse.json({ ok: true, successCount, downloadCount });
  } catch {
    return NextResponse.json({ ok: false, successCount: 0, downloadCount: 0 }, { status: 200 });
  }
}

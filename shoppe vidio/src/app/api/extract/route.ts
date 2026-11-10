import { NextRequest, NextResponse } from "next/server";
import {
  extractShopeeVideo,
  checkRateLimit,
  DEMO_RESULT,
  type ExtractOutcome,
} from "@/lib/shopee";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  let body: { url?: string; forceDemo?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: "INVALID_URL", message: "Permintaan tidak valid." },
      { status: 400 }
    );
  }

  const rawUrl = (body.url ?? "").toString().slice(0, 2048);
  if (!rawUrl.trim()) {
    return NextResponse.json(
      { ok: false, code: "INVALID_URL", message: "Masukkan tautan produk Shopee terlebih dahulu." },
      { status: 400 }
    );
  }

  if (!checkRateLimit(clientIp(req))) {
    return NextResponse.json(
      { ok: false, code: "RATE_LIMITED", message: "Terlalu banyak permintaan. Tunggu satu menit lalu coba lagi." },
      { status: 429 }
    );
  }

  // Demo mode: user explicitly asked to preview the flow.
  if (body.forceDemo) {
    void logExtraction("demo", true, "DEMO", "shopee.co.id");
    return NextResponse.json({
      ok: true,
      code: "SUCCESS",
      message: "Ini video demo. Pada server produksi, alur yang sama digunakan untuk video Shopee asli.",
      data: DEMO_RESULT,
    });
  }

  let outcome: ExtractOutcome;
  try {
    outcome = await extractShopeeVideo(rawUrl);
  } catch {
    outcome = {
      ok: false,
      code: "UNKNOWN_ERROR",
      message: "Terjadi kesalahan tak terduga saat memproses tautan. Coba lagi.",
      data: null,
    };
  }

  void logExtraction("shopee", outcome.ok, outcome.code, outcome.data?.region ?? null);

  return NextResponse.json(outcome, { status: outcome.ok ? 200 : 422 });
}

async function logExtraction(source: string, ok: boolean, code: string | null, region: string | null) {
  try {
    await db.extractionLog.create({
      data: { source, ok, code, region },
    });
  } catch {
    // logging must never break the main flow
  }
}

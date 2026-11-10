import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

/**
 * Host allowlist — the proxy may only fetch media from TikTok/bytedance CDNs
 * and the tikwm resolver. Prevents SSRF against internal addresses.
 */
const ALLOWED_HOST_PATTERNS = [
  "tiktok.com",
  "tiktokcdn",
  "tiktokv",
  "byteoversea",
  "ibyteimg",
  "byteimg",
  "bytedance",
  "byteintl",
  "byteacct",
  "muscdn.com",
  "musical.ly",
  "tikwm.com",
  "akamaized.net",
];

function isAllowedTarget(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (u.username || u.password) return false;
    const host = u.hostname.toLowerCase();
    return ALLOWED_HOST_PATTERNS.some((p) => host.includes(p));
  } catch {
    return false;
  }
}

function safeFilename(name: string): string {
  const cleaned = name
    .replace(/[^\w.\-@]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return cleaned || "tiktok-download";
}

export async function GET(req: NextRequest) {
  const limit = rateLimit(`dl:${clientIp(req)}`, 60);
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Terlalu banyak permintaan. Coba lagi dalam ${limit.retryAfter} detik.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const { searchParams } = new URL(req.url);
  const target = searchParams.get("url");
  const rawName = searchParams.get("filename") || "tiktok-download.mp4";
  const inline = searchParams.get("inline") === "1";

  if (!target || !isAllowedTarget(target)) {
    return NextResponse.json(
      { error: "Parameter url tidak valid atau tidak diizinkan." },
      { status: 400 }
    );
  }

  try {
    const headers: Record<string, string> = {
      "User-Agent": UA,
      Referer: "https://www.tiktok.com/",
      Accept: "*/*",
    };
    const range = req.headers.get("range");
    if (range) headers.Range = range;

    const upstream = await fetch(target, { headers, cache: "no-store" });

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        { error: `Gagal mengambil file dari server TikTok (status ${upstream.status}).` },
        { status: 502 }
      );
    }

    const out = new Headers();
    const pass = ["content-type", "content-length", "content-range", "accept-ranges"];
    for (const h of pass) {
      const v = upstream.headers.get(h);
      if (v) out.set(h, v);
    }
    if (!out.has("content-type")) out.set("content-type", "application/octet-stream");
    out.set(
      "content-disposition",
      `${inline ? "inline" : "attachment"}; filename="${safeFilename(rawName)}"`
    );
    out.set("cache-control", "no-store");

    return new NextResponse(upstream.body, { status: upstream.status, headers: out });
  } catch (err) {
    console.error("tiktok download proxy error:", err);
    return NextResponse.json(
      { error: "Gagal mengunduh file. Silakan coba lagi." },
      { status: 502 }
    );
  }
}

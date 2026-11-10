import { NextRequest } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Streaming download proxy.
 * Purpose: (a) attach Content-Disposition so the file downloads with a nice
 * filename, (b) bypass CORS, (c) never leak the browser's IP/headers upstream.
 *
 * SSRF protection: only whitelisted Shopee media hosts + the demo video host
 * are allowed. Everything else is rejected.
 */

const ALLOWED_HOST_SUFFIXES = [
  // Shopee video CDNs
  ".shopee.vn", ".shopee.sg", ".shopee.co.id", ".shopeemobile.com",
  ".shopee.com.my", ".shopee.co.th", ".shopee.ph", ".shopee.tw",
  ".shopee.com.br", ".shopee.cl", ".shopee.mx",
  // Shopee image CDNs
  ".susercontent.com", ".sc-cdn.net",
  // Demo video host (sandbox-safe sample)
  "test-videos.co.uk",
];

function isAllowed(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  const hostAllowed =
    ALLOWED_HOST_SUFFIXES.some((s) => host.endsWith(s)) ||
    ALLOWED_HOST_SUFFIXES.some((s) => !s.startsWith(".") && host === s);
  if (!hostAllowed) return false;
  // Block non-https and credentials tricks.
  return url.protocol === "https:" && !url.username && !url.password;
}

function sanitizeFilename(name: string): string {
  const clean = name.replace(/[^\w\-. ]+/g, "").replace(/\s+/g, " ").trim();
  return (clean || "video-shopee").slice(0, 120);
}

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("u");
  const name = req.nextUrl.searchParams.get("name");
  const source = req.nextUrl.searchParams.get("source") ?? "shopee";

  if (!target) {
    return new Response("Parameter 'u' wajib diisi.", { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return new Response("URL tidak valid.", { status: 400 });
  }

  if (!isAllowed(url)) {
    return new Response("Host tidak diizinkan.", { status: 403 });
  }

  const filename = sanitizeFilename(name ?? "video-shopee.mp4");
  const extMatch = url.pathname.match(/\.(mp4|mov|webm|m3u8)$/i);
  const fileExt = extMatch ? extMatch[1].toLowerCase() : "mp4";
  const finalName = filename.endsWith(`.${fileExt}`) ? filename : `${filename}.${fileExt}`;

  try {
    const upstream = await fetch(url.toString(), {
      headers: {
        // Some Shopee CDNs require a browser-ish UA and a Referer.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Referer: "https://shopee.co.id/",
        Accept: "video/webm,video/mp4,*/*",
        Range: req.headers.get("range") ?? "bytes=0-",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });

    if (!upstream.ok && upstream.status !== 206) {
      return new Response(`Gagal mengambil video (HTTP ${upstream.status}).`, {
        status: 502,
      });
    }

    if (source === "shopee") {
      void db.extractionLog
        .create({ data: { source: "download", ok: true, code: "DOWNLOAD", region: null } })
        .catch(() => undefined);
    }

    const headers = new Headers();
    headers.set("Content-Type", upstream.headers.get("content-type") ?? `video/${fileExt}`);
    const len = upstream.headers.get("content-length");
    if (len) headers.set("Content-Length", len);
    const cr = upstream.headers.get("content-range");
    if (cr) headers.set("Content-Range", cr);
    headers.set("Accept-Ranges", "bytes");
    headers.set(
      "Content-Disposition",
      `attachment; filename="${finalName}"; filename*=UTF-8''${encodeURIComponent(finalName)}`
    );
    headers.set("Cache-Control", "private, max-age=0, no-store");

    return new Response(upstream.body, {
      status: upstream.status === 206 ? 206 : 200,
      headers,
    });
  } catch {
    return new Response("Koneksi ke CDN video gagal. Coba lagi.", { status: 504 });
  }
}

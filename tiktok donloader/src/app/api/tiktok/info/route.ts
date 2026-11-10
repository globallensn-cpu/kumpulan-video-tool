import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

/** Normalize relative tikwm paths into absolute URLs */
function abs(u?: string | null): string | null {
  if (!u) return null;
  if (u.startsWith("http")) return u;
  if (u.startsWith("/")) return `https://www.tikwm.com${u}`;
  return u;
}

/** Extract first http(s) URL from a blob of share text */
function extractUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s"'<>]+/i);
  return m ? m[0] : null;
}

function isTikTokHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h.includes("tiktok") ||
    h === "douyin.com" ||
    h.endsWith(".douyin.com")
  );
}

export async function POST(req: NextRequest) {
  const limit = rateLimit(`info:${clientIp(req)}`, 20);
  if (!limit.ok) {
    return NextResponse.json(
      {
        error: `Terlalu banyak permintaan. Coba lagi dalam ${limit.retryAfter} detik.`,
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  try {
    const body = await req.json().catch(() => null);
    const raw = String(body?.url ?? "").trim();
    if (!raw) {
      return NextResponse.json(
        { error: "Masukkan link TikTok terlebih dahulu." },
        { status: 400 }
      );
    }

    const url = extractUrl(raw);
    if (!url) {
      return NextResponse.json(
        { error: "Link tidak valid. Contoh: https://www.tiktok.com/@user/video/123" },
        { status: 400 }
      );
    }

    let host = "";
    try {
      host = new URL(url).hostname;
    } catch {
      return NextResponse.json(
        { error: "Link tidak valid. Periksa kembali URL Anda." },
        { status: 400 }
      );
    }

    if (!isTikTokHost(host)) {
      return NextResponse.json(
        { error: "Ini bukan link TikTok. Gunakan link dari aplikasi/website TikTok." },
        { status: 400 }
      );
    }

    const api = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);

    let json: {
      code: number;
      msg?: string;
      data?: Record<string, unknown>;
    };
    try {
      const res = await fetch(api, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });
      json = await res.json();
    } catch {
      return NextResponse.json(
        { error: "Server sedang sibuk atau timeout. Silakan coba lagi." },
        { status: 504 }
      );
    } finally {
      clearTimeout(timer);
    }

    if (json.code !== 0 || !json.data) {
      const msg = json.msg || "Gagal memproses link ini.";
      const friendly =
        /limit|spam/i.test(msg)
          ? "Terlalu banyak permintaan. Tunggu beberapa detik lalu coba lagi."
          : /parsing/i.test(msg)
            ? "Link tidak dapat dibaca. Pastikan Anda menyalin link lengkap dari aplikasi atau website TikTok."
            : /not found|invalid|cannot|deleted|private/i.test(msg)
              ? "Video tidak ditemukan. Link mungkin salah atau video telah dihapus / bersifat privat."
              : msg;
      return NextResponse.json({ error: friendly }, { status: 422 });
    }

    const d = json.data;
    const author = (d.author ?? {}) as Record<string, unknown>;
    const musicInfo = (d.music_info ?? {}) as Record<string, unknown>;
    const images = Array.isArray(d.images) ? (d.images as string[]) : [];
    const num = (v: unknown): number | null =>
      typeof v === "number" && Number.isFinite(v) ? v : null;

    const noWatermark = abs(d.play as string | null);
    const noWatermarkHd = abs(d.hdplay as string | null);
    const watermark = abs(d.wmplay as string | null);

    return NextResponse.json({
      id: String(d.id ?? ""),
      caption: String(d.title ?? ""),
      duration: num(d.duration),
      cover: abs(d.cover as string | null),
      originCover: abs(d.origin_cover as string | null),
      author: {
        username: String(author.unique_id ?? author.id ?? ""),
        nickname: String(author.nickname ?? ""),
        avatar: abs(author.avatar as string | null),
      },
      stats: {
        plays: num(d.play_count),
        likes: num(d.digg_count),
        comments: num(d.comment_count),
        shares: num(d.share_count),
      },
      music: {
        title: String(musicInfo.title ?? ""),
        author: String(musicInfo.author ?? ""),
        url: abs(d.music as string | null),
      },
      video:
        noWatermark || noWatermarkHd || watermark
          ? {
              noWatermark,
              noWatermarkHd,
              watermark,
              sizeNoWatermark: num(d.size),
              sizeHd: num(d.hd_size),
              sizeWatermark: num(d.wm_size),
            }
          : null,
      images: images.map((i) => abs(i)).filter(Boolean) as string[],
      isSlideshow: images.length > 0,
    });
  } catch (err) {
    console.error("tiktok info error:", err);
    return NextResponse.json(
      { error: "Terjadi kesalahan tak terduga. Silakan coba lagi." },
      { status: 500 }
    );
  }
}

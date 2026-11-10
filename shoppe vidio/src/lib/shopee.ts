/**
 * Shopee video extraction library (server-side only).
 *
 * Pipeline:
 *  1. Normalize & validate the pasted URL (product link, /product/ path,
 *     affiliate links with `i.<shop>.<item>` embedded, or short links).
 *  2. Resolve short links (s.shopee.xx / shope.ee) by following redirects.
 *  3. Extract shopId + itemId via regex.
 *  4. Try multiple extraction strategies against Shopee endpoints
 *     (JSON APIs first, then HTML scraping with a crawler UA).
 *  5. Flexibly locate the video object in the payload (field names change
 *     between regions/versions), then build a normalized result.
 *
 * NOTE: Shopee aggressively blocks datacenter IPs. On hosting with a clean
 * (residential / non-flagged) IP these strategies work directly; otherwise
 * the caller receives code SHOPEE_BLOCKED and can fall back to a demo.
 */

export interface ShopeeVideoResult {
  source: "shopee" | "demo";
  /** "product" = video on a product page; "feed" = Shopee Video (creator feed) */
  kind: "product" | "feed";
  itemId: string;
  shopId: string;
  title: string;
  shopName: string | null;
  price: number | null;
  rating: number | null;
  soldCount: number | null;
  likeCount: number | null;
  videoUrl: string | null;
  videoCover: string | null;
  videoDurationMs: number | null;
  /** Exact byte size of the served file (from CDN or payload). */
  videoSizeBytes: number | null;
  /** Original rendition resolution, when known. */
  videoWidth: number | null;
  videoHeight: number | null;
  /** Human label like "1080p" derived from the rendition resolution. */
  videoQualityLabel: string | null;
  /** True only when Shopee exposes no clean rendition at all. */
  videoWatermarked: boolean;
  images: string[];
  region: string | null;
  productUrl: string | null;
}

export type ExtractCode =
  | "SUCCESS"
  | "INVALID_URL"
  | "SHORT_RESOLVE_FAILED"
  | "NOT_FOUND"
  | "NO_VIDEO"
  | "SHOPEE_BLOCKED"
  | "UNKNOWN_ERROR";

export interface ExtractOutcome {
  ok: boolean;
  code: ExtractCode;
  message: string;
  data: ShopeeVideoResult | null;
}

/* ------------------------------------------------------------------ */
/* Region & host knowledge                                             */
/* ------------------------------------------------------------------ */

const REGION_HOSTS = [
  "shopee.co.id", "shopee.sg", "shopee.com.my", "shopee.co.th",
  "shopee.vn", "shopee.ph", "shopee.tw", "shopee.com.br",
  "shopee.cl", "shopee.mx", "shopee.co", "shopee.pl",
];

const SHORT_HOSTS = [
  "s.shopee.co.id", "s.shopee.sg", "s.shopee.com.my", "s.shopee.co.th",
  "s.shopee.vn", "s.shopee.ph", "s.shopee.tw", "shope.ee", "shp.ee",
];

const UA_BROWSER =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const UA_CRAWLER = "TelegramBot (like TwitterBot)";

const IMAGE_CDN = "https://down-id.img.susercontent.com/file/";

/* ------------------------------------------------------------------ */
/* URL parsing                                                         */
/* ------------------------------------------------------------------ */

export interface ParsedLink {
  shopId: string;
  itemId: string;
  region: string;
  productUrl: string;
}

export function normalizeInputUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withScheme);
    return u.toString();
  } catch {
    return null;
  }
}

function hostMatches(host: string, list: string[]): boolean {
  return list.some((h) => host === h || host.endsWith(`.${h}`));
}

/** Extract shop/item ids from any Shopee URL shape. */
export function parseShopeeIds(rawUrl: string): ParsedLink | null {
  const urlStr = normalizeInputUrl(rawUrl);
  if (!urlStr) return null;
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();

  const isShopee = hostMatches(host, REGION_HOSTS);
  const isShort = hostMatches(host, SHORT_HOSTS);
  if (!isShopee && !isShort) return null;

  // 1) Classic slug: ...-i.<shopId>.<itemId>  (also inside query params)
  const patterns = [
    /[\/?&=]i\.(\d{4,})\.(\d{4,})/,
    /-i\.(\d{4,})\.(\d{4,})/,
  ];
  const haystack = `${url.pathname}${url.search}`;
  for (const re of patterns) {
    const m = haystack.match(re);
    if (m) return buildParsed(host, m[1], m[2]);
  }

  // 2) /product/<shopId>/<itemId>
  const m2 = url.pathname.match(/\/product\/(\d{4,})\/(\d{4,})/);
  if (m2) return buildParsed(host, m2[1], m2[2]);

  // 3) Mobile universal-link: .../universal-link/production/.../?item_id=..&shop_id=..
  const itemIdQ = url.searchParams.get("item_id") || url.searchParams.get("productId");
  const shopIdQ = url.searchParams.get("shop_id") || url.searchParams.get("shopId");
  if (itemIdQ && shopIdQ && /^\d+$/.test(itemIdQ) && /^\d+$/.test(shopIdQ)) {
    return buildParsed(host, shopIdQ, itemIdQ);
  }

  // Short link -> needs resolving
  if (isShort) return null;
  return null;
}

function buildParsed(host: string, shopId: string, itemId: string): ParsedLink {
  const region = REGION_HOSTS.find((h) => host === h || host.endsWith(`.${h}`)) ?? "shopee.co.id";
  const productUrl = `https://${region}/product/${shopId}/${itemId}`;
  return { shopId, itemId, region, productUrl };
}

/** True when the URL is a Shopee short link that must be resolved. */
export function isShortLink(rawUrl: string): boolean {
  const urlStr = normalizeInputUrl(rawUrl);
  if (!urlStr) return false;
  try {
    const host = new URL(urlStr).hostname.toLowerCase();
    return hostMatches(host, SHORT_HOSTS);
  } catch {
    return false;
  }
}

/**
 * Follow a short link (s.shopee.xx / shope.ee / shp.ee) and return the final
 * landing URL, unwrapping meta-refresh / JS interstitials when needed.
 */
export async function resolveShortFinalUrl(rawUrl: string): Promise<string | null> {
  const urlStr = normalizeInputUrl(rawUrl);
  if (!urlStr) return null;

  try {
    const res = await fetch(urlStr, {
      redirect: "follow",
      headers: { "User-Agent": UA_BROWSER, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(20_000),
    });
    const finalUrl = res.url;

    // Some short links resolve to an interstitial page with meta refresh / JS redirect.
    const html = await res.text();
    const meta = html.match(/http-equiv=["']?refresh["']?[^>]*url=([^"'>]+)/i);
    if (meta) {
      return new URL(meta[1].replace(/&amp;/g, "&"), finalUrl).toString();
    }
    const js = html.match(/(?:window\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']/i);
    if (js) {
      return new URL(js[1], finalUrl).toString();
    }
    return finalUrl;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Shopee Video (creator feed) support                                 */
/* ------------------------------------------------------------------ */

export interface ParsedShareVideo {
  postId: string;
  region: string;
  pageUrl: string;
}

/**
 * Detect Shopee Video share links:
 *   https://sv.shopee.co.id/share-video/<postId>
 * (also reached by resolving id.shp.ee/xxx short links)
 */
export function parseShareVideoUrl(rawUrl: string): ParsedShareVideo | null {
  const urlStr = normalizeInputUrl(rawUrl);
  if (!urlStr) return null;
  try {
    const url = new URL(urlStr);
    const host = url.hostname.toLowerCase();
    if (!hostMatches(host, REGION_HOSTS)) return null;
    const m = url.pathname.match(/\/share-video\/([^/?#]+)/i);
    if (!m) return null;
    const postId = decodeURIComponent(m[1]);
    if (!postId) return null;
    const region = REGION_HOSTS.find((h) => host === h || host.endsWith(`.${h}`)) ?? "shopee.co.id";
    const pageUrl = `https://sv.${region}/share-video/${encodeURIComponent(postId)}`;
    return { postId, region, pageUrl };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Rendition selection (original quality, no watermark)                */
/* ------------------------------------------------------------------ */

interface VideoRendition {
  url: string;
  width: number | null;
  height: number | null;
  bitrate: number | null;
  sizeBytes: number | null;
  codec: string | null;
  defn: string | null;
}

/** Label like "1080p" from width/height (portrait-safe: uses the longer side). */
function qualityLabel(w: number | null, h: number | null): string | null {
  const long = Math.max(w ?? 0, h ?? 0);
  if (!long) return null;
  if (long >= 2000) return "2K";
  if (long >= 1000) return "1080p";
  if (long >= 700) return "720p";
  if (long >= 500) return "540p";
  if (long >= 400) return "480p";
  if (long >= 300) return "360p";
  return `${long}p`;
}

/** H264 plays everywhere; H265 often fails in browsers → rank it lowest. */
function codecRank(codec: string | null): number {
  if (!codec) return 1;
  const c = codec.toUpperCase();
  if (c.includes("264") || c.includes("AVC")) return 2;
  if (c.includes("265") || c.includes("HEVC")) return 0;
  return 1;
}

/** Best playable rendition: H264 first, then highest pixels, then bitrate. */
function chooseBestRendition(list: VideoRendition[]): VideoRendition | null {
  if (!list.length) return null;
  return [...list].sort((a, b) => {
    const rank = codecRank(b.codec) - codecRank(a.codec);
    if (rank !== 0) return rank;
    const px = (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0);
    if (px !== 0) return px;
    return (b.bitrate ?? 0) - (a.bitrate ?? 0);
  })[0];
}

/**
 * Collect every clean (non-watermark) rendition from a Shopee Video payload.
 *
 * Shopee keeps several renditions per video:
 *  - `formats[]`        → standard H264 renditions (V540P / V720P / V1080P)
 *  - `mmsData`          → default_format + extend_formats (codec, size, bitrate)
 *  - `url`              → the web player default (clean H264)
 *  - `watermarkVideoUrl`→ watermarked share rendition — NEVER included here.
 */
function collectFeedRenditions(video: Record<string, unknown>): VideoRendition[] {
  const out = new Map<string, VideoRendition>();

  const push = (raw: Record<string, unknown>, opts?: { codec?: string | null }) => {
    const url = typeof raw.url === "string" ? raw.url.trim() : "";
    if (!url || !/^https?:\/\//i.test(url) || /watermark/i.test(url)) return;
    const next: VideoRendition = {
      url,
      width: typeof raw.width === "number" ? raw.width : null,
      height: typeof raw.height === "number" ? raw.height : null,
      bitrate: typeof raw.bitrate === "number" ? raw.bitrate : null,
      sizeBytes: typeof raw.size === "number" ? raw.size : null,
      codec: opts?.codec ?? (typeof raw.codec === "string" ? raw.codec : null),
      defn: typeof raw.defn === "string" ? raw.defn : null,
    };
    const prev = out.get(url);
    if (!prev) {
      out.set(url, next);
      return;
    }
    // Merge — fill in fields the duplicate entry was missing.
    out.set(url, {
      url,
      width: prev.width ?? next.width,
      height: prev.height ?? next.height,
      bitrate: prev.bitrate ?? next.bitrate,
      sizeBytes: prev.sizeBytes ?? next.sizeBytes,
      codec: prev.codec === null ? next.codec : prev.codec,
      defn: prev.defn ?? next.defn,
    });
  };

  // 1) formats[] — the standard H264 renditions.
  if (Array.isArray(video.formats)) {
    for (const f of video.formats as Record<string, unknown>[]) push(f, { codec: "H264" });
  }

  // 2) mmsData.default_format + mmsData.extend_formats (carry codec + exact size).
  let mms: unknown = video.mmsData;
  if (typeof mms === "string") {
    try {
      mms = JSON.parse(mms);
    } catch {
      mms = null;
    }
  }
  if (mms && typeof mms === "object") {
    const m = mms as Record<string, unknown>;
    if (m.default_format && typeof m.default_format === "object") {
      push(m.default_format as Record<string, unknown>);
    }
    if (m.extend_formats && typeof m.extend_formats === "object") {
      for (const list of Object.values(m.extend_formats as Record<string, unknown>)) {
        if (Array.isArray(list)) {
          for (const f of list as Record<string, unknown>[]) push(f);
        }
      }
    }
  }

  // 3) video.url — the web player default (clean H264 rendition).
  push({ url: video.url, width: video.width, height: video.height });

  // 4) Legacy keys found in some regional payloads (clean sources only).
  for (const key of ["noWatermarkVideoUrl", "videoUrl"]) {
    const u = video[key];
    if (typeof u === "string" && u.trim()) {
      push({ url: u.startsWith("//") ? `https:${u}` : u });
    }
  }

  return [...out.values()];
}

async function headContentLength(url: string): Promise<number | null> {
  try {
    const res = await fetchWithTimeout(url, { method: "HEAD", headers: { "User-Agent": UA_BROWSER } }, 6_000);
    const len = res.headers.get("content-length");
    if (len) return Number(len) || null;
    // Some CDNs reject HEAD — fall back to a 1-byte ranged GET.
    const res2 = await fetchWithTimeout(url, { headers: { "User-Agent": UA_BROWSER, Range: "bytes=0-0" } }, 6_000);
    const m = res2.headers.get("content-range")?.match(/\/(\d+)$/);
    if (m) return Number(m[1]) || null;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Extract a Shopee Video (creator feed) item from its public share page.
 * The share page is server-side rendered and NOT behind the anti-bot wall,
 * so this works from any IP — unlike the product-page pipeline.
 *
 * Watermark handling: the share page only exposes the watermarked rendition
 * (`watermarkVideoUrl`). The creator page (`/web/@<user>/video/<id>`) exposes
 * the full rendition map incl. the clean originals (up to 1080p) — we always
 * prefer those and never serve the watermarked file unless nothing else exists.
 */
async function extractFeedVideo(meta: ParsedShareVideo): Promise<ExtractOutcome> {
  try {
    const res = await fetchWithTimeout(meta.pageUrl, {
      headers: { "User-Agent": UA_BROWSER, Accept: "text/html,application/xhtml+xml" },
    });
    if (!res.ok) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "Halaman Shopee Video tidak dapat diakses. Tautan mungkin sudah kedaluwarsa atau video telah dihapus.",
        data: null,
      };
    }
    const html = await res.text();

    // Base info from the share page's __NEXT_DATA__ (always present on SSR pages).
    const nextMatch = html.match(
      /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i
    );
    let cover: string | null = null;
    let caption: string | null = null;
    let creator: string | null = null;
    let durationMs: number | null = null;
    let likeCount: number | null = null;
    let shareVideo: Record<string, unknown> = {};

    if (nextMatch) {
      try {
        const json = JSON.parse(nextMatch[1]) as Record<string, unknown>;
        const mediaInfo = pick(json, "props.pageProps.mediaInfo") as Record<string, unknown> | undefined;
        shareVideo = (mediaInfo?.video ?? {}) as Record<string, unknown>;
        const count = (mediaInfo?.count ?? {}) as Record<string, unknown>;
        const userInfo = (mediaInfo?.userInfo ?? {}) as Record<string, unknown>;

        cover = asString(pick(shareVideo, "noWatermarkCoverUrl", "coverUrl", "watermarkCoverUrl"));
        if (cover && cover.startsWith("//")) cover = `https:${cover}`;
        caption = asString(pick(shareVideo, "caption"));
        creator = asString(pick(userInfo, "videoUserName"));
        durationMs = typeof shareVideo.duration === "number" ? shareVideo.duration : null;
        likeCount = typeof count.likeCount === "number" ? count.likeCount : null;
      } catch {
        /* fall through to og tags */
      }
    }
    if (!cover) {
      cover = html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1] ?? null;
    }
    // og:image often carries Shopee's `@imgwm_…` watermark suffix — strip it.
    if (cover && cover.includes("@imgwm")) cover = cover.split("@imgwm")[0];
    if (!caption) {
      caption = html.match(/property=["']og:description["'][^>]*content=["']([^"']+)["']/i)?.[1] ?? null;
    }
    if (!creator) {
      creator = html.match(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1]?.replace(/\s+on\s+Shopee Video.*$/i, "") ?? null;
    }

    // --- Clean rendition discovery -----------------------------------------
    // The share page only exposes the watermarked file. The creator page
    // (/web/@<user>/video/<id>) carries the full rendition map — clean
    // originals up to 1080p — so prefer it whenever we know the username.
    let chosen: VideoRendition | null = null;
    let watermarked = false;
    let product: {
      name: string | null;
      shopId: string | null;
      itemId: string | null;
      price: number | null;
      rating: number | null;
      sold: number | null;
      image: string | null;
    } | null = null;

    if (creator) {
      const userPageUrl = `https://sv.${meta.region}/web/@${encodeURIComponent(creator)}/video/${encodeURIComponent(meta.postId)}`;
      try {
        const res2 = await fetchWithTimeout(userPageUrl, {
          headers: { "User-Agent": UA_BROWSER, Accept: "text/html,application/xhtml+xml" },
        });
        if (res2.ok) {
          const html2 = await res2.text();
          const m2 = html2.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
          if (m2) {
            const json2 = JSON.parse(m2[1]) as Record<string, unknown>;
            const pageProps = pick(json2, "props.pageProps") as Record<string, unknown> | undefined;
            const timeline = pageProps?.timelineVideo as { list?: unknown } | undefined;
            const entry = Array.isArray(timeline?.list)
              ? (timeline.list[0] as Record<string, unknown> | undefined)
              : undefined;
            const content = (entry?.content ?? {}) as Record<string, unknown>;
            const entryMeta = (entry?.meta ?? {}) as Record<string, unknown>;
            const video = (content.video ?? {}) as Record<string, unknown>;
            const countInfo = (entryMeta.countInfo ?? {}) as Record<string, unknown>;

            if (typeof countInfo.likes === "number") likeCount = countInfo.likes;
            if (typeof video.duration === "number") durationMs = video.duration;
            const userCover = asString(video.cover);
            if (userCover) cover = userCover;

            chosen = chooseBestRendition(collectFeedRenditions(video));

            // Linked product enrichment (price / rating / sold / image).
            const pv = content.productV2 as Record<string, unknown> | null | undefined;
            if (pv && typeof pv === "object") {
              const priceRaw = (pv.itemPrice as Record<string, unknown> | undefined)?.price;
              const ratingRaw = (pv.reviewRating as Record<string, unknown> | undefined)?.ratingStar;
              const soldRaw = (pv.sellStat as Record<string, unknown> | undefined)?.historicalSold;
              const imgId = (pv.itemImage as Record<string, unknown> | undefined)?.imageId;
              product = {
                name: asString(pv.itemName),
                shopId: asId(pv.shopId),
                itemId: asId(pv.itemId),
                price: typeof priceRaw === "number" ? priceRaw / 100_000 : null,
                rating: typeof ratingRaw === "number" ? Math.round(ratingRaw * 100) / 100 : null,
                sold: typeof soldRaw === "number" ? soldRaw : null,
                image: typeof imgId === "string" && imgId ? `${IMAGE_CDN}${imgId}` : null,
              };
            }
          }
        }
      } catch {
        /* creator page failed — fall through to share-page sources */
      }
    }

    if (!chosen) {
      // Legacy regional payloads expose a clean key directly.
      const legacy = asString(pick(shareVideo, "noWatermarkVideoUrl", "videoUrl"));
      if (legacy) {
        chosen = {
          url: legacy.startsWith("//") ? `https:${legacy}` : legacy,
          width: null, height: null, bitrate: null, sizeBytes: null, codec: null, defn: null,
        };
      } else {
        // Last resort: mine every mp4 on the page and keep the largest file.
        // The watermarked share rendition is always far smaller than the
        // original renditions (e.g. 4.5 MB vs 12–33 MB).
        const wmUrl = asString(pick(shareVideo, "watermarkVideoUrl"));
        const urls = [
          ...new Set(
            (html.match(/https?:\/\/[a-z0-9.-]*(?:vod|video)[a-z0-9.-]*\/[^"'\s<>\\]+\.mp4/gi) ?? []).map((u) =>
              u.replace(/\\u002F/g, "/")
            )
          ),
        ].filter((u) => u !== wmUrl);
        const sized = await Promise.all(
          urls.slice(0, 8).map(async (u) => ({ u, n: await headContentLength(u) }))
        );
        const best = sized.filter((x) => x.n).sort((a, b) => (b.n ?? 0) - (a.n ?? 0))[0];
        if (best) {
          chosen = {
            url: best.u,
            width: null, height: null, bitrate: null, sizeBytes: best.n, codec: null, defn: null,
          };
        } else if (wmUrl) {
          // Nothing clean exists — serve the watermarked share file, honestly labelled.
          chosen = {
            url: wmUrl.startsWith("//") ? `https:${wmUrl}` : wmUrl,
            width: null, height: null, bitrate: null, sizeBytes: null, codec: null, defn: null,
          };
          watermarked = true;
        }
      }
    }

    if (!chosen) {
      return {
        ok: false,
        code: "NO_VIDEO",
        message: "Halaman Shopee Video dibuka, tetapi URL video tidak ditemukan. Video mungkin sudah dihapus atau dibatasi.",
        data: null,
      };
    }

    const sizeBytes = chosen.sizeBytes ?? (await headContentLength(chosen.url));

    const result: ShopeeVideoResult = {
      source: "shopee",
      kind: "feed",
      itemId: meta.postId,
      shopId: product?.shopId ?? "",
      title: caption ?? product?.name ?? `Video dari ${creator ?? "kreator Shopee"}`,
      shopName: creator,
      price: product?.price ?? null,
      rating: product?.rating ?? null,
      soldCount: product?.sold ?? null,
      likeCount,
      videoUrl: chosen.url,
      videoCover: cover,
      videoDurationMs: durationMs,
      videoSizeBytes: sizeBytes,
      videoWidth: chosen.width,
      videoHeight: chosen.height,
      videoQualityLabel: qualityLabel(chosen.width, chosen.height),
      videoWatermarked: watermarked,
      images: [cover, product?.image].filter((x): x is string => !!x),
      region: meta.region,
      productUrl:
        product?.itemId && product?.shopId
          ? `https://${meta.region}/product/${product.shopId}/${product.itemId}`
          : meta.pageUrl,
    };

    return {
      ok: true,
      code: "SUCCESS",
      message: watermarked
        ? "Video ditemukan. Versi tanpa watermark tidak tersedia dari Shopee untuk video ini — file dikirim apa adanya."
        : "Video asli tanpa watermark (kualitas tertinggi) berhasil ditemukan.",
      data: result,
    };
  } catch {
    return {
      ok: false,
      code: "UNKNOWN_ERROR",
      message: "Gagal menghubungi halaman Shopee Video. Periksa tautan lalu coba lagi.",
      data: null,
    };
  }
}



const VIDEO_HOST_RE =
  /^https?:\/\/[a-z0-9.-]*(?:video|vod|hd)\.v\.shopee[a-z.]*\/[^\s"'\\]+$/i;

/** Recursively search any JSON structure for a Shopee video URL. */
function findVideoUrl(node: unknown, depth = 0): string | null {
  if (depth > 12 || node == null) return null;
  if (typeof node === "string") {
    const s = node.trim();
    if (VIDEO_HOST_RE.test(s)) return s;
    return null;
  }
  if (Array.isArray(node)) {
    for (const v of node) {
      const hit = findVideoUrl(v, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const keys = Object.keys(obj);
    // Prefer obvious keys first.
    for (const k of keys) {
      if (/^(video_url|videoUrl|url|source|play_url|playUrl)$/i.test(k)) {
        const hit = findVideoUrl(obj[k], depth + 1);
        if (hit) return hit;
      }
    }
    for (const k of keys) {
      const hit = findVideoUrl(obj[k], depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Like asString but also accepts numeric ids (payloads mix both). */
function asId(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function normalizeImageRef(ref: unknown): string | null {
  const s = asString(ref);
  if (!s) return null;
  if (s.startsWith("http")) return s;
  return `${IMAGE_CDN}${s}`;
}

function pick(obj: Record<string, unknown>, ...paths: string[]): unknown {
  for (const p of paths) {
    let cur: unknown = obj;
    let ok = true;
    for (const seg of p.split(".")) {
      if (cur && typeof cur === "object" && seg in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[seg];
      } else {
        ok = false;
        break;
      }
    }
    if (ok && cur != null) return cur;
  }
  return undefined;
}

/** Normalize an item payload (from API or embedded JSON) into our result. */
function buildResultFromItem(
  item: Record<string, unknown>,
  meta: { shopId: string; itemId: string; region: string; productUrl: string }
): ShopeeVideoResult {
  const videoObj = (pick(item, "video", "videoInfo", "video_info") ?? {}) as Record<string, unknown>;
  let videoUrl = findVideoUrl(videoObj) ?? findVideoUrl(item);
  let videoSizeBytes: number | null = null;

  // Product payloads often carry a `versions` list of renditions with exact
  // sizes — the largest file is the original-quality rendition, so prefer it.
  const versions = pick(videoObj, "versions");
  if (Array.isArray(versions)) {
    const sized = (versions as Record<string, unknown>[])
      .filter((v) => typeof v?.url === "string" && typeof v?.size === "number")
      .sort((a, b) => (b.size as number) - (a.size as number));
    if (sized[0]) {
      videoUrl = sized[0].url as string;
      videoSizeBytes = sized[0].size as number;
    }
  }
  const videoWidth = typeof videoObj.width === "number" ? videoObj.width : null;
  const videoHeight = typeof videoObj.height === "number" ? videoObj.height : null;

  const cover =
    asString(pick(item, "video.cover_url", "video.coverUrl", "videoInfo.cover_url", "videoInfo.cover")) ??
    normalizeImageRef(pick(item, "image", "cover", "video.cover"));

  const imagesRaw = pick(item, "images");
  const images: string[] = Array.isArray(imagesRaw)
    ? imagesRaw.map(normalizeImageRef).filter((x): x is string => !!x)
    : cover
      ? [cover]
      : [];

  const priceRaw = pick(item, "price", "price_min");
  const price = typeof priceRaw === "number" ? priceRaw / 100_000 : null;

  const ratingRaw = pick(item, "item_rating.rating_star", "rating_star");
  const rating = typeof ratingRaw === "number" ? Math.round(ratingRaw * 100) / 100 : null;

  const soldRaw = pick(item, "sold", "historical_sold", "global_sold_count");
  const soldCount = typeof soldRaw === "number" ? soldRaw : null;

  const durationRaw =
    pick(item, "video.duration_ms", "video.duration", "videoInfo.duration_ms", "videoInfo.duration");
  const videoDurationMs = typeof durationRaw === "number" ? durationRaw : null;

  return {
    source: "shopee",
    kind: "product",
    itemId: meta.itemId,
    shopId: meta.shopId,
    title: asString(pick(item, "name", "item_name")) ?? "Produk Shopee",
    shopName: asString(pick(item, "shop_info.shop_name", "shop.name", "shop_name", "seller_info.shop_name")),
    price,
    rating,
    soldCount,
    likeCount: null,
    videoUrl,
    videoCover: cover ? (cover.startsWith("http") ? cover : `${IMAGE_CDN}${cover}`) : null,
    videoDurationMs,
    videoSizeBytes,
    videoWidth,
    videoHeight,
    videoQualityLabel: qualityLabel(videoWidth, videoHeight),
    videoWatermarked: false,
    images,
    region: meta.region,
    productUrl: meta.productUrl,
  };
}

/* ------------------------------------------------------------------ */
/* Extraction strategies (server-side)                                 */
/* ------------------------------------------------------------------ */

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 20_000) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(ms), cache: "no-store" });
}

const BASE_HEADERS: Record<string, string> = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
  Referer: "https://shopee.co.id/",
  Origin: "https://shopee.co.id",
  "X-API-SOURCE": "pc",
  "X-Requested-With": "XMLHttpRequest",
  "X-Shopee-Client": "ver=1",
};

async function tryApiGetPc(meta: ParsedLink): Promise<Record<string, unknown> | null> {
  const url = `https://${meta.region}/api/v4/pdp/get_pc?item_id=${meta.itemId}&shop_id=${meta.shopId}&detail_level=0`;
  const res = await fetchWithTimeout(url, {
    headers: { ...BASE_HEADERS, "User-Agent": UA_CRAWLER },
  });
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!json || json.error != null && json.error !== 0) return null;
  return json;
}

async function tryApiItemGet(meta: ParsedLink): Promise<Record<string, unknown> | null> {
  const url = `https://${meta.region}/api/v4/item/get?itemid=${meta.itemId}&shopid=${meta.shopId}`;
  const res = await fetchWithTimeout(url, {
    headers: { ...BASE_HEADERS, "User-Agent": UA_CRAWLER },
  });
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!json || json.error != null && json.error !== 0) return null;
  return json;
}

/** Scrape the rendered product page (works with crawler-friendly UAs). */
async function tryHtmlScrape(meta: ParsedLink): Promise<Record<string, unknown> | null> {
  const slugUrl = `https://${meta.region}/product/${meta.shopId}/${meta.itemId}`;
  const res = await fetchWithTimeout(slugUrl, {
    headers: { "User-Agent": UA_CRAWLER, Accept: "text/html,application/xhtml+xml" },
  });
  if (!res.ok) return null;
  const html = await res.text();

  // og:video / video meta tags
  const ogVideo = html.match(/property=["']og:video["'][^>]*content=["']([^"']+)["']/i)
    ?? html.match(/content=["']([^"']+)["'][^>]*property=["']og:video["']/i);
  if (ogVideo) {
    return {
      _scraped: true,
      name: html.match(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1] ?? "Produk Shopee",
      video: { video_url: ogVideo[1], cover_url: html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1] },
    } as Record<string, unknown>;
  }

  // Embedded JSON: look for a video url blob anywhere in the HTML.
  const direct = html.match(/https?[^"'\s\\]*(?:video|vod|hd)\.v\.shopee[^"'\s\\]+/i);
  if (direct) {
    return {
      _scraped: true,
      name: html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.replace(/\s*[|\-–]\s*Shopee.*$/i, "") ?? "Produk Shopee",
      video: { video_url: direct[0].replace(/\\u002F/g, "/") },
    } as Record<string, unknown>;
  }

  // __NEXT_DATA__ style embedded item
  const nextData = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (nextData) {
    try {
      const parsed = JSON.parse(nextData[1]);
      const mined = mineEmbeddedItem(parsed);
      if (mined) return mined;
    } catch { /* ignore */ }
  }
  return null;
}

function mineEmbeddedItem(node: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 8 || node == null || typeof node !== "object") return null;
  const obj = node as Record<string, unknown>;
  const hasVideo = findVideoUrl(obj);
  const hasName = typeof obj.name === "string" || typeof obj.item_name === "string";
  const hasImages = Array.isArray(obj.images) || typeof obj.image === "string";
  if (hasVideo && hasName && (hasImages || obj.video)) return obj;
  for (const v of Object.values(obj)) {
    const hit = mineEmbeddedItem(v, depth + 1);
    if (hit) return hit;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* In-memory cache + rate limit                                        */
/* ------------------------------------------------------------------ */

const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_MAX = 500;
const cache = new Map<string, { outcome: ExtractOutcome; expires: number }>();

function cacheGet(key: string): ExtractOutcome | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    cache.delete(key);
    return null;
  }
  return hit.outcome;
}

function cacheSet(key: string, outcome: ExtractOutcome) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { outcome, expires: Date.now() + CACHE_TTL_MS });
}

const RATE_MAX = 20;
const RATE_WINDOW_MS = 60_000;
const rateMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= RATE_MAX;
}

/* ------------------------------------------------------------------ */
/* Public entry point                                                  */
/* ------------------------------------------------------------------ */

export async function extractShopeeVideo(rawUrl: string): Promise<ExtractOutcome> {
  const urlStr = normalizeInputUrl(rawUrl);
  if (!urlStr) {
    return { ok: false, code: "INVALID_URL", message: "Tautan tidak dikenali. Pastikan Anda menempelkan link Shopee yang valid.", data: null };
  }

  const cacheKey = urlStr;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  // 1) Direct Shopee Video (creator feed) share link?
  let svPost = parseShareVideoUrl(urlStr);

  // 2) Direct product link?
  let meta = svPost ? null : parseShopeeIds(urlStr);

  // 3) Short link (s.shopee.xx / shope.ee / shp.ee) -> resolve to landing URL.
  if (!svPost && !meta && isShortLink(urlStr)) {
    const finalUrl = await resolveShortFinalUrl(urlStr);
    if (finalUrl) {
      svPost = parseShareVideoUrl(finalUrl);
      meta = svPost ? null : parseShopeeIds(finalUrl);
    }
    if (!svPost && !meta) {
      const failed: ExtractOutcome = {
        ok: false, code: "SHORT_RESOLVE_FAILED",
        message: "Short link Shopee berhasil diikuti, tetapi tidak mengarah ke video atau produk. Buka tautan di aplikasi Shopee, lalu gunakan Share → Salin Link.",
        data: null,
      };
      cacheSet(cacheKey, failed);
      return failed;
    }
  }

  // Shopee Video (creator feed) pipeline — works from any server IP.
  if (svPost) {
    const outcome = await extractFeedVideo(svPost);
    cacheSet(cacheKey, outcome);
    return outcome;
  }

  if (!meta) {
    const failed: ExtractOutcome = {
      ok: false, code: "INVALID_URL",
      message: "Tautan bukan link Shopee yang dikenali. Format yang didukung: link produk (shopee.co.id/produk-i.123.456), link Shopee Video (sv.shopee.co.id/share-video/…), atau short link (s.shopee.co.id, shope.ee, shp.ee).",
      data: null,
    };
    cacheSet(cacheKey, failed);
    return failed;
  }

  const meta0 = meta;

  // Strategy chain: JSON APIs first, HTML scraping as fallback.
  const strategies: Array<(m: ParsedLink) => Promise<Record<string, unknown> | null>> = [
    tryApiGetPc,
    tryApiItemGet,
    tryHtmlScrape,
  ];

  let payload: Record<string, unknown> | null = null;
  let reachedBlocked = false;

  for (const strategy of strategies) {
    try {
      payload = await strategy(meta0);
      if (payload) break;
    } catch {
      // network failure / timeout -> try next
    }
    // All failed so far; assume blocking until proven otherwise.
    reachedBlocked = true;
  }

  if (!payload) {
    const failed: ExtractOutcome = {
      ok: false,
      code: "SHOPEE_BLOCKED",
      message:
        "Shopee menolak permintaan dari server ini (perlindungan anti-bot). Ekstraksi berjalan normal pada server produksi dengan IP bersih; coba lagi nanti atau gunakan mode demo.",
      data: null,
    };
    cacheSet(cacheKey, failed);
    return failed;
  }

  void reachedBlocked;

  const item = (pick(payload, "data.item", "item", "data") ?? payload) as Record<string, unknown>;
  const result = buildResultFromItem(item, {
    shopId: meta0.shopId,
    itemId: meta0.itemId,
    region: meta0.region,
    productUrl: meta0.productUrl,
  });

  if (!result.videoUrl) {
    const failed: ExtractOutcome = {
      ok: false,
      code: "NO_VIDEO",
      message: "Produk ini tidak memiliki video, atau videonya belum tersedia. Pilih produk lain yang memiliki video di halamannya.",
      data: result,
    };
    cacheSet(cacheKey, failed);
    return failed;
  }

  const success: ExtractOutcome = {
    ok: true, code: "SUCCESS",
    message: "Video berhasil ditemukan.",
    data: result,
  };
  cacheSet(cacheKey, success);
  return success;
}

/* ------------------------------------------------------------------ */
/* Demo fallback (used when Shopee blocks the server IP)               */
/* ------------------------------------------------------------------ */

export const DEMO_RESULT: ShopeeVideoResult = {
  source: "demo",
  kind: "product",
  itemId: "0000000000",
  shopId: "0000000000",
  title: "Mode Demo — Video Contoh Produk",
  shopName: "Toko Demo",
  price: 89000,
  rating: 4.8,
  soldCount: 1250,
  likeCount: null,
  videoUrl: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4",
  videoCover: "/demo-poster.svg",
  videoDurationMs: 10_000,
  videoSizeBytes: 1_048_576,
  videoWidth: 1280,
  videoHeight: 720,
  videoQualityLabel: "720p",
  videoWatermarked: false,
  images: [],
  region: "shopee.co.id",
  productUrl: null,
};

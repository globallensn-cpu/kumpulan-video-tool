/**
 * Simple in-memory sliding-window rate limiter (per server instance).
 * Suitable for single-instance deployments; no external cache needed.
 */

type Bucket = number[];

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;

export function rateLimit(
  key: string,
  max: number
): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter((t) => now - t < WINDOW_MS);

  if (arr.length >= max) {
    buckets.set(key, arr);
    return {
      ok: false,
      retryAfter: Math.max(1, Math.ceil((WINDOW_MS - (now - arr[0])) / 1000)),
    };
  }

  arr.push(now);
  buckets.set(key, arr);

  // Opportunistic cleanup to keep memory bounded
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t >= WINDOW_MS)) buckets.delete(k);
    }
  }

  return { ok: true, retryAfter: 0 };
}

/** Best-effort client IP behind the gateway */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "local";
}

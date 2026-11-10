/** Shared helpers for downloader & frame extractor */

export const fmtNum = (n?: number | null) => {
  if (n == null) return "-";
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "jt";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "rb";
  return String(n);
};

export const fmtBytes = (b?: number | null) => {
  if (!b || b <= 0) return null;
  const mb = b / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
};

export const fmtDur = (s?: number | null) => {
  if (s == null || s <= 0 || Number.isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
};

export const safeName = (s: string) =>
  s.replace(/[^\w\-]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) ||
  "tiktok";

export const dlUrl = (url: string, filename: string, inline = false) =>
  `/api/tiktok/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(
    filename
  )}${inline ? "&inline=1" : ""}`;

/** m:ss display of seconds */
export const fmtTime = fmtDur;

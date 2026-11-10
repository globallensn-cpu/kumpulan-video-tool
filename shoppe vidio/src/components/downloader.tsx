"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Download,
  ClipboardPaste,
  Play,
  Star,
  Store,
  Package,
  Link2,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  X,
  ImageIcon,
  Sparkles,
  Heart,
  Clock3,
  Info,
  User,
  Clapperboard,
} from "lucide-react";

interface ShopeeVideoResult {
  source: "shopee" | "demo";
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
  videoSizeBytes: number | null;
  videoWidth: number | null;
  videoHeight: number | null;
  videoQualityLabel: string | null;
  videoWatermarked: boolean;
  images: string[];
  region: string | null;
  productUrl: string | null;
}

interface ExtractResponse {
  ok: boolean;
  code: string;
  message: string;
  data: ShopeeVideoResult | null;
}

type Phase = "idle" | "loading" | "result" | "error";

const LOADING_STEPS = [
  "Memvalidasi tautan…",
  "Menghubungi server Shopee…",
  "Mencari video produk…",
  "Menyiapkan pratinjau…",
];

function formatPrice(price: number | null): string | null {
  if (price == null) return null;
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(price);
}

function formatSold(n: number | null): string | null {
  if (n == null) return null;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)} rb terjual`;
  return `${n} terjual`;
}

function formatLikes(n: number | null): string | null {
  if (n == null) return null;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)} rb suka`;
  return `${n} suka`;
}

function formatDuration(ms: number | null): string | null {
  if (ms == null || ms <= 0) return null;
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}d` : `${s} detik`;
}

function formatSize(bytes: number | null): string | null {
  if (bytes == null || bytes <= 0) return null;
  const mb = bytes / 1_048_576;
  if (mb >= 1) return `${mb.toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "video-shopee";
}

export function Downloader() {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [stepIdx, setStepIdx] = useState(0);
  const [result, setResult] = useState<ShopeeVideoResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Rotate loading messages
  useEffect(() => {
    if (phase !== "loading") return;
    const t = setInterval(() => setStepIdx((i) => (i + 1) % LOADING_STEPS.length), 1200);
    return () => clearInterval(t);
  }, [phase]);

  const scrollToResult = useCallback(() => {
    requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, []);

  const submit = useCallback(
    async (opts?: { forceDemo?: boolean }) => {
      const target = opts?.forceDemo ? "demo" : url.trim();
      if (!opts?.forceDemo && !target) {
        toast({
          title: "Tautan kosong",
          description: "Tempel tautan produk Shopee terlebih dahulu.",
          variant: "destructive",
        });
        inputRef.current?.focus();
        return;
      }
      setPhase("loading");
      setStepIdx(0);
      try {
        const res = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: target, forceDemo: opts?.forceDemo ?? false }),
        });
        const json = (await res.json()) as ExtractResponse;

        if (json.ok && json.data?.videoUrl) {
          setResult(json.data);
          setPhase("result");
          scrollToResult();
          if (json.data.source === "demo") {
            toast({
              title: "Mode demo aktif",
              description: "Video contoh dimuat untuk menunjukkan alur kerja. Di server produksi, video Shopee asli akan muncul di sini.",
            });
          } else {
            toast({ title: "Video ditemukan!", description: "Pratinjau siap. Klik tombol unduh untuk menyimpan." });
          }
        } else {
          setResult(null);
          setErrorMsg(json.message || "Gagal memproses tautan.");
          setErrorCode(json.code || "UNKNOWN_ERROR");
          setPhase("error");
          scrollToResult();
        }
      } catch {
        setResult(null);
        setErrorMsg("Tidak dapat terhubung ke server. Periksa koneksi internet Anda lalu coba lagi.");
        setErrorCode("NETWORK_ERROR");
        setPhase("error");
        scrollToResult();
      }
    },
    [url, toast, scrollToResult]
  );

  const downloadUrl = (target: ShopeeVideoResult, kind: "video" | "thumb") => {
    if (kind === "video") {
      const name = `${slugify(target.title)}-shopsave`;
      return `/api/download?u=${encodeURIComponent(target.videoUrl ?? "")}&name=${encodeURIComponent(name)}&source=${target.source}`;
    }
    if (target.videoCover) {
      return `/api/download?u=${encodeURIComponent(target.videoCover)}&name=${encodeURIComponent(slugify(target.title))}-thumbnail&source=${target.source}`;
    }
    return null;
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
        inputRef.current?.focus();
        toast({ title: "Tautan ditempel", description: "Klik tombol Unduh Video untuk melanjutkan." });
      } else {
        toast({ title: "Clipboard kosong", description: "Salin dulu tautan produk dari aplikasi Shopee." });
      }
    } catch {
      toast({
        title: "Tidak bisa mengakses clipboard",
        description: "Izinkan akses clipboard di browser Anda, atau tempel manual dengan Ctrl+V.",
        variant: "destructive",
      });
    }
  };

  const clearAll = () => {
    setUrl("");
    setPhase("idle");
    setResult(null);
    setErrorMsg("");
    inputRef.current?.focus();
  };

  const isDemo = result?.source === "demo";

  return (
    <div className="w-full max-w-3xl mx-auto" id="tool">
      {/* Input card */}
      <Card className="border-2 shadow-xl shadow-primary/5 rounded-2xl">
        <CardContent className="p-4 sm:p-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (phase !== "loading") void submit();
            }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <div className="relative flex-1">
              <Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4.5 text-muted-foreground shrink-0" aria-hidden />
              <Input
                ref={inputRef}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Tempel tautan produk Shopee di sini…"
                className="pl-11 pr-10 h-13 min-h-12 text-base rounded-xl"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                aria-label="Tautan produk Shopee"
                disabled={phase === "loading"}
              />
              {url && phase !== "loading" && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Bersihkan"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {phase === "loading" ? (
              <Button disabled className="h-13 min-h-12 rounded-xl px-8 text-base font-semibold" aria-live="polite">
                <Loader2 className="size-5 animate-spin" />
                Memproses…
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button type="submit" className="h-13 min-h-12 rounded-xl px-6 sm:px-8 text-base font-semibold flex-1 sm:flex-none shadow-lg shadow-primary/25">
                  <Download className="size-5" />
                  Unduh Video
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-13 min-h-12 rounded-xl px-4"
                  onClick={handlePaste}
                  aria-label="Tempel dari clipboard"
                  title="Tempel dari clipboard"
                >
                  <ClipboardPaste className="size-5" />
                </Button>
              </div>
            )}
          </form>

          {phase === "loading" && (
            <div className="mt-4 flex items-center gap-2.5 text-sm text-muted-foreground" aria-live="polite">
              <Loader2 className="size-4 animate-spin text-primary" />
              <span>{LOADING_STEPS[stepIdx]}</span>
            </div>
          )}

          <p className="mt-3.5 text-xs sm:text-sm text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-primary" /> Tanpa watermark</span>
            <span className="inline-flex items-center gap-1.5"><Sparkles className="size-3.5 text-primary" /> Kualitas asli / HD</span>
            <span className="inline-flex items-center gap-1.5"><Download className="size-3.5 text-primary" /> 100% gratis</span>
          </p>
        </CardContent>
      </Card>

      {/* Loading skeleton */}
      {phase === "loading" && (
        <Card className="mt-6 rounded-2xl overflow-hidden">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row gap-5">
              <Skeleton className="w-full sm:w-64 aspect-video rounded-xl shrink-0" />
              <div className="flex-1 space-y-3 w-full">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/5" />
                <div className="pt-2 flex gap-2">
                  <Skeleton className="h-11 w-44 rounded-xl" />
                  <Skeleton className="h-11 w-32 rounded-xl" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {phase === "result" && result && (
        <div ref={resultRef} className="mt-6">
          {isDemo && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
              <Sparkles className="mt-0.5 size-4.5 shrink-0 text-amber-600" aria-hidden />
              <p className="text-foreground/90">
                <strong>Mode demo.</strong> Shopee memblokir permintaan dari IP server sandbox ini. Di server produksi
                dengan IP bersih, video Shopee asli akan muncul dengan alur yang persis sama — pratinjau, info produk, dan unduhan.
              </p>
            </div>
          )}

          <Card className="rounded-2xl overflow-hidden shadow-xl shadow-primary/5">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row gap-5">
                {/* Video preview */}
                <div className="w-full sm:w-72 shrink-0">
                  <div className={`relative rounded-xl overflow-hidden bg-black/90 mx-auto ${result.kind === "feed" ? "w-full max-w-[280px] aspect-[9/16]" : "aspect-video sm:w-auto sm:max-h-[440px]"}`}>
                    <video
                      key={result.videoUrl ?? "v"}
                      controls
                      playsInline
                      preload="metadata"
                      poster={result.videoCover ?? undefined}
                      className="w-full h-full object-contain"
                      aria-label={`Pratinjau video: ${result.title}`}
                    >
                      <source src={result.videoUrl ?? ""} type="video/mp4" />
                    </video>
                  </div>
                  <Badge
                    className="mt-3 w-full justify-center gap-1.5 py-1.5"
                    variant={result.videoWatermarked ? "outline" : "secondary"}
                  >
                    {result.videoWatermarked ? (
                      <>
                        <AlertTriangle className="size-3.5 text-amber-600" /> Ber-watermark · versi bersih tidak tersedia
                      </>
                    ) : result.kind === "feed" ? (
                      <>
                        <Clapperboard className="size-3.5 text-primary" /> Shopee Video · Tanpa watermark
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="size-3.5 text-primary" /> Tanpa watermark · Kualitas asli
                      </>
                    )}
                  </Badge>
                  {!isDemo && !result.videoWatermarked && (result.videoQualityLabel || formatSize(result.videoSizeBytes)) && (
                    <p className="mt-1.5 text-center text-xs text-muted-foreground">
                      {[result.videoQualityLabel, formatSize(result.videoSizeBytes), "MP4"].filter(Boolean).join(" · ")}
                      {result.videoWidth && result.videoHeight && (
                        <> · {result.videoWidth}×{result.videoHeight}</>
                      )}
                    </p>
                  )}
                </div>

                {/* Product info + actions */}
                <div className="flex-1 min-w-0 flex flex-col">
                  <h3 className="text-lg font-semibold leading-snug line-clamp-3" title={result.title}>
                    {result.title}
                  </h3>

                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                    {result.shopName && (
                      <span className="inline-flex items-center gap-1.5">
                        {result.kind === "feed" ? <User className="size-4 text-primary" /> : <Store className="size-4 text-primary" />}
                        {result.shopName}
                      </span>
                    )}
                    {result.rating != null && (
                      <span className="inline-flex items-center gap-1">
                        <Star className="size-4 fill-amber-400 text-amber-400" />
                        {result.rating.toFixed(1)}
                      </span>
                    )}
                    {formatLikes(result.likeCount) && (
                      <span className="inline-flex items-center gap-1.5">
                        <Heart className="size-4 fill-rose-500 text-rose-500" />
                        {formatLikes(result.likeCount)}
                      </span>
                    )}
                    {formatSold(result.soldCount) && (
                      <span className="inline-flex items-center gap-1.5">
                        <Package className="size-4" />
                        {formatSold(result.soldCount)}
                      </span>
                    )}
                    {formatDuration(result.videoDurationMs) && (
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 className="size-4" />
                        {formatDuration(result.videoDurationMs)}
                      </span>
                    )}
                  </div>

                  {result.kind === "feed" && (
                    <p className="mt-3 flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      {result.videoWatermarked
                        ? "Untuk video ini Shopee tidak menyediakan versi bersih — file share ber-watermark dikirim apa adanya."
                        : "Video dari feed Shopee Video, diambil langsung dari rendisi asli kualitas tertinggi milik kreator — tanpa watermark dan tanpa rekompresi."}
                    </p>
                  )}

                  {formatPrice(result.price) && (
                    <p className="mt-2 text-2xl font-bold text-primary">{formatPrice(result.price)}</p>
                  )}

                  <Separator className="my-4" />

                  <div className="flex flex-wrap gap-2.5">
                    <Button asChild size="lg" className="rounded-xl font-semibold shadow-lg shadow-primary/25">
                      <a href={downloadUrl(result, "video") ?? "#"} download>
                        <Download className="size-5" />
                        Unduh Video (MP4)
                      </a>
                    </Button>
                    {result.videoCover && (
                      <Button asChild size="lg" variant="outline" className="rounded-xl">
                        <a href={downloadUrl(result, "thumb") ?? "#"} download>
                          <ImageIcon className="size-5" />
                          Thumbnail
                        </a>
                      </Button>
                    )}
                    {result.productUrl && (
                      <Button asChild size="lg" variant="ghost" className="rounded-xl">
                        <a href={result.productUrl} target="_blank" rel="noopener noreferrer">
                          Buka di Shopee
                        </a>
                      </Button>
                    )}
                  </div>

                  <div className="mt-auto pt-4 text-xs text-muted-foreground">
                    {result.kind === "product" ? (
                      <p>
                        Kode produk: <span className="font-mono">{result.itemId}</span> · Toko:{" "}
                        <span className="font-mono">{result.shopId}</span>
                        {result.region && <> · Region: <span className="font-mono">{result.region}</span></>}
                      </p>
                    ) : (
                      <p>
                        Shopee Video · ID: <span className="font-mono line-clamp-1">{result.itemId}</span>
                        {result.region && <> · Region: <span className="font-mono">{result.region}</span></>}
                      </p>
                    )}
                    <p className="mt-1">Gunakan hanya untuk kebutuhan pribadi, reseller, atau konten afiliasi sesuai Ketentuan Layanan.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error */}
      {phase === "error" && (
        <div ref={resultRef} className="mt-6">
          <div className="flex items-start gap-3.5 rounded-2xl border border-destructive/30 bg-destructive/5 px-5 py-4">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-destructive">Gagal memproses tautan</p>
              <p className="mt-1 text-sm text-foreground/85">{errorMsg}</p>
              <div className="mt-3 flex flex-wrap gap-2.5">
                {errorCode === "SHOPEE_BLOCKED" && (
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => void submit({ forceDemo: true })}>
                    <Play className="size-4" />
                    Coba Video Demo
                  </Button>
                )}
                <Button size="sm" variant="outline" className="rounded-lg" onClick={() => void submit()}>
                  Coba Lagi
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

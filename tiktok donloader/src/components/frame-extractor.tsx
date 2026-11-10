"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { dlUrl, fmtBytes, fmtDur, safeName } from "@/lib/media";
import {
  Upload,
  Link2,
  Loader2,
  Film,
  Download,
  Scissors,
  X,
  FileVideo,
  Camera,
  Trash2,
  PackageOpen,
  Crop,
  Clock3,
  Ruler,
  Info,
} from "lucide-react";

type Frame = { url: string; blob: Blob; time: number; index: number };
type Mode = "upload" | "tiktok";
type ImgFormat = "jpeg" | "png";
type ExtractMode = "count" | "fps" | "interval";

type Source = {
  kind: Mode;
  label: string;
  src: string;
  /** Alternate stream (H.264) used when the primary (HD/HEVC) cannot be decoded by the browser */
  fallbackSrc?: string | null;
  usingFallback?: boolean;
  sizeBytes: number | null;
  author?: string;
  fileBase: string;
};

type VideoMeta = { width: number; height: number; duration: number };

const FRAME_COUNTS = ["6", "9", "12", "16", "24"];
const FPS_CHIPS = [0.5, 1, 2, 5, 10, 30];
const INTERVAL_CHIPS = [1, 2, 5, 10, 30];
const MAX_FRAMES = 120;
const EXTRACT_MODES: { value: ExtractMode; label: string; hint: string }[] = [
  {
    value: "count",
    label: "Jumlah Frame",
    hint: "Frame disebar merata di seluruh durasi video.",
  },
  {
    value: "fps",
    label: "Per Detik (FPS)",
    hint: "Ambil frame dengan frekuensi tetap — 1 FPS = 1 frame setiap detik.",
  },
  {
    value: "interval",
    label: "Setiap N Detik",
    hint: "Ambil 1 frame setiap beberapa detik — cocok untuk video panjang.",
  },
];

export default function FrameExtractor() {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>("upload");
  const [source, setSource] = useState<Source | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [tiktokUrl, setTiktokUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);

  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [compatNote, setCompatNote] = useState<string | null>(null);
  const [sliderT, setSliderT] = useState(0);
  const sourceRef = useRef<Source | null>(null);
  const metaPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    sourceRef.current = source;
  }, [source]);
  useEffect(
    () => () => {
      if (metaPollRef.current) clearInterval(metaPollRef.current);
    },
    []
  );

  const [frameCount, setFrameCount] = useState("9");
  const [format, setFormat] = useState<ImgFormat>("jpeg");
  const [extractMode, setExtractMode] = useState<ExtractMode>("count");
  const [fpsVal, setFpsVal] = useState("1");
  const [intervalVal, setIntervalVal] = useState("5");

  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [zipping, setZipping] = useState(false);

  const [frames, setFrames] = useState<Frame[]>([]);
  const framesRef = useRef<Frame[]>([]);
  useEffect(() => {
    framesRef.current = frames;
  }, [frames]);
  useEffect(
    () => () => {
      framesRef.current.forEach((f) => URL.revokeObjectURL(f.url));
    },
    []
  );

  const clearFrames = useCallback(() => {
    framesRef.current.forEach((f) => URL.revokeObjectURL(f.url));
    setFrames([]);
  }, []);

  const resetSource = () => {
    clearFrames();
    setSource((prev) => {
      if (prev?.kind === "upload") URL.revokeObjectURL(prev.src);
      return null;
    });
    setMeta(null);
    setVideoError(null);
    setCompatNote(null);
    setSourceError(null);
    setSliderT(0);
    setProgress(0);
  };

  /** Switch to the H.264 fallback stream when the primary stream cannot be decoded */
  const tryFallback = useCallback(() => {
    const cur = sourceRef.current;
    if (!cur || cur.usingFallback || !cur.fallbackSrc) return false;
    setCompatNote(
      "Kualitas HD (codec HEVC) tidak didukung browser ini — otomatis beralih ke kualitas original (H.264). Hasil download tetap bisa pakai HD."
    );
    setMeta(null);
    setSliderT(0);
    setSource({ ...cur, src: cur.fallbackSrc, usingFallback: true });
    return true;
  }, []);

  /* ---------- Upload flow ---------- */

  const loadFile = useCallback(
    (file: File) => {
      const isVideo =
        file.type.startsWith("video/") || /\.(mp4|mov|webm|mkv|m4v|avi)$/i.test(file.name);
      if (!isVideo) {
        setSourceError("File bukan video. Gunakan format MP4, MOV, atau WebM.");
        return;
      }
      if (file.size > 300 * 1024 * 1024) {
        setSourceError("Ukuran video terlalu besar (maksimal 300 MB).");
        return;
      }
      clearFrames();
      setSource((prev) => {
        if (prev?.kind === "upload") URL.revokeObjectURL(prev.src);
        return null;
      });
      setMeta(null);
      setVideoError(null);
      setCompatNote(null);
      setSourceError(null);
      setSliderT(0);
      setSource({
        kind: "upload",
        label: file.name,
        src: URL.createObjectURL(file),
        sizeBytes: file.size,
        fileBase: safeName(file.name.replace(/\.[^.]+$/, "")) || "video",
      });
    },
    [clearFrames]
  );

  /* ---------- TikTok flow ---------- */

  const analyzeTikTok = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const val = tiktokUrl.trim();
    if (!val) {
      setSourceError("Masukkan link TikTok terlebih dahulu.");
      return;
    }
    setAnalyzing(true);
    setSourceError(null);
    setVideoError(null);
    try {
      const res = await fetch("/api/tiktok/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: val }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSourceError(data?.error || "Gagal memproses link. Coba lagi.");
        return;
      }
      if (data.isSlideshow || !data.video) {
        setSourceError("Post ini berupa foto slideshow, bukan video. Gunakan link video TikTok.");
        return;
      }
      const play = data.video.noWatermarkHd || data.video.noWatermark;
      if (!play) {
        setSourceError("Video tidak dapat diputar untuk ekstraksi. Coba link TikTok lain.");
        return;
      }
      clearFrames();
      setSource((prev) => {
        if (prev?.kind === "upload") URL.revokeObjectURL(prev.src);
        return null;
      });
      setMeta(null);
      setCompatNote(null);
      setSliderT(0);
      const playOriginal = data.video.noWatermark as string;
      const playHd = data.video.noWatermarkHd as string | null;
      const primary = playHd || playOriginal;
      setSource({
        kind: "tiktok",
        label: (data.caption || `TikTok ${data.id}`).slice(0, 80),
        src: dlUrl(primary, "tiktok-source.mp4", true),
        fallbackSrc: playHd ? dlUrl(playOriginal, "tiktok-source.mp4", true) : null,
        usingFallback: false,
        sizeBytes: data.video.sizeHd || data.video.sizeNoWatermark || null,
        author: data.author?.username,
        fileBase: `tiktok_${data.author?.username ? "@" + safeName(data.author.username) + "_" : ""}${data.id || Date.now()}`,
      });
      toast({ title: "Video TikTok siap!", description: "Pilih jumlah frame lalu klik Ekstrak." });
    } catch {
      setSourceError("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setAnalyzing(false);
    }
  };

  /* ---------- Video events ---------- */

  const onLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    const attempt = () => {
      if (v.videoWidth && v.videoHeight) {
        setMeta({ width: v.videoWidth, height: v.videoHeight, duration: v.duration || 0 });
        return true;
      }
      return false;
    };
    if (v.duration === Infinity || Number.isNaN(v.duration)) {
      const onDurChange = () => {
        v.removeEventListener("durationchange", onDurChange);
        v.currentTime = 0;
        if (!attempt()) tryFallback();
      };
      v.addEventListener("durationchange", onDurChange);
      v.currentTime = 1e7;
    } else if (!attempt()) {
      // Some builds report dimensions with a short delay — poll briefly before fallback
      if (metaPollRef.current) clearInterval(metaPollRef.current);
      let tries = 0;
      metaPollRef.current = setInterval(() => {
        if (attempt()) {
          if (metaPollRef.current) clearInterval(metaPollRef.current);
          metaPollRef.current = null;
          return;
        }
        tries += 1;
        if (tries >= 10) {
          if (metaPollRef.current) clearInterval(metaPollRef.current);
          metaPollRef.current = null;
          if (!tryFallback()) {
            setVideoError(
              "Browser ini tidak dapat mendekode video tersebut (codec tidak didukung, mis. HEVC/ProRes). Coba konversi ke MP4 H.264 atau gunakan Chrome/Safari terbaru."
            );
          }
        }
      }, 250);
    }
  };

  const onVideoError = () => {
    if (tryFallback()) return;
    setVideoError(
      sourceRef.current?.usingFallback || sourceRef.current?.kind === "upload"
        ? "Video gagal dimuat. Format mungkin tidak didukung browser ini — coba konversi ke MP4 H.264."
        : "Video gagal dimuat — tautan CDN mungkin sudah kedaluwarsa. Klik Analisis lagi untuk memperbarui."
    );
  };

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (v && !extracting) setSliderT(v.currentTime);
  };

  /* ---------- Extraction (Canvas API) ---------- */

  const seekTo = (v: HTMLVideoElement, t: number) =>
    new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        v.removeEventListener("seeked", finish);
        resolve();
      };
      v.addEventListener("seeked", finish);
      try {
        v.currentTime = Math.max(0, Math.min(t, (v.duration || 0) - 0.05));
      } catch {
        finish();
      }
      setTimeout(finish, 4000);
    });

  const captureAt = async (t: number, index: number): Promise<Frame | null> => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return null;
    await seekTo(v, t);
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, format === "png" ? "image/png" : "image/jpeg", 0.92)
    );
    if (!blob) return null;
    return { blob, time: v.currentTime, index, url: URL.createObjectURL(blob) };
  };

  const frameFileName = (f: Frame) =>
    `${source?.fileBase || "video"}_frame_${String(f.index + 1).padStart(2, "0")}_${fmtDur(
      f.time
    ).replace(":", "-")}.${format === "png" ? "png" : "jpg"}`;

  /** Parse a decimal-friendly number (accepts comma), clamped to [min, max] */
  const toNum = (v: string, min: number, max: number, dflt: number) => {
    const n = parseFloat(String(v).trim().replace(",", "."));
    if (!Number.isFinite(n)) return dflt;
    return Math.min(max, Math.max(min, n));
  };

  /** Timestamp plan for the current mode & settings, capped at MAX_FRAMES */
  const buildPlan = (duration: number): { ts: number[]; truncated: boolean } => {
    if (duration <= 0) return { ts: [], truncated: false };
    if (extractMode === "count") {
      const n = parseInt(frameCount, 10) || 9;
      const start = duration * 0.03;
      const end = duration * 0.97;
      return {
        ts: Array.from({ length: n }, (_, i) =>
          n === 1 ? duration / 2 : start + ((end - start) * i) / (n - 1)
        ),
        truncated: false,
      };
    }
    const step =
      extractMode === "fps" ? 1 / toNum(fpsVal, 0.1, 30, 1) : toNum(intervalVal, 0.5, 60, 5);
    const raw = Math.ceil(duration / step);
    const n = Math.min(raw, MAX_FRAMES);
    return {
      ts: Array.from({ length: n }, (_, i) => i * step),
      truncated: raw > MAX_FRAMES,
    };
  };

  const extractAll = async () => {
    const v = videoRef.current;
    if (!v || !meta || meta.duration <= 0) {
      toast({ title: "Video belum siap", description: "Tunggu video selesai dimuat.", variant: "destructive" });
      return;
    }
    const plan = buildPlan(meta.duration);
    if (!plan.ts.length) {
      toast({
        title: "Video terlalu pendek untuk pengaturan ini",
        description: "Turunkan FPS atau perkecil interval, lalu coba lagi.",
        variant: "destructive",
      });
      return;
    }
    const ts = plan.ts;
    const n = ts.length;
    setExtracting(true);
    setProgress(0);
    clearFrames();
    const out: Frame[] = [];
    for (let i = 0; i < n; i++) {
      setProgressLabel(`Mengekstrak frame ${i + 1} dari ${n}…`);
      const f = await captureAt(ts[i], i);
      if (f) {
        out.push(f);
        setFrames([...out]);
      }
      setProgress(Math.round(((i + 1) / n) * 100));
    }
    setProgressLabel("");
    setExtracting(false);
    setSliderT(v.currentTime);
    if (out.length) {
      toast({
        title: `${out.length} frame berhasil diekstrak!`,
        description: plan.truncated
          ? `Dibatasi ${MAX_FRAMES} frame pertama (0:00–${fmtDur(ts[ts.length - 1])}). Turunkan FPS atau perbesar interval untuk cakupan penuh.`
          : "Klik unduh per frame atau ambil semuanya sebagai ZIP.",
      });
    } else {
      toast({ title: "Gagal mengekstrak frame", description: "Coba format video lain atau link berbeda.", variant: "destructive" });
    }
  };

  const captureCurrent = async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) {
      toast({ title: "Video belum siap", variant: "destructive" });
      return;
    }
    setCapturing(true);
    const f = await captureAt(v.currentTime, frames.length);
    setCapturing(false);
    if (f) {
      setFrames((prev) => [...prev, f]);
      toast({ title: `Frame di ${fmtDur(f.time)} ditambahkan!` });
    } else {
      toast({ title: "Gagal mengambil frame", variant: "destructive" });
    }
  };

  const downloadFrame = (f: Frame) => {
    const a = document.createElement("a");
    a.href = f.url;
    a.download = frameFileName(f);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const downloadZip = async () => {
    if (!frames.length) return;
    setZipping(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      frames.forEach((f) => zip.file(frameFileName(f), f.blob));
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `frames_${source?.fileBase || "video"}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast({ title: "ZIP siap diunduh!", description: `${frames.length} frame dalam satu arsip.` });
    } catch {
      toast({ title: "Gagal membuat ZIP", variant: "destructive" });
    } finally {
      setZipping(false);
    }
  };

  const clearAllFrames = () => {
    clearFrames();
    toast({ title: "Semua frame dihapus" });
  };

  /* ---------- UI ---------- */

  const est = meta && meta.duration > 0 ? buildPlan(meta.duration) : null;

  return (
    <div className="space-y-6">
      {/* Source card */}
      <Card className="border-white/10 bg-white/[0.04] backdrop-blur rounded-2xl">
        <CardContent className="p-4 sm:p-6 space-y-5">
          {/* Mode switch */}
          <div className="grid grid-cols-2 gap-2 max-w-md" role="tablist" aria-label="Sumber video">
            <Button
              type="button"
              onClick={() => setMode("upload")}
              aria-pressed={mode === "upload"}
              className={`h-11 ${mode === "upload"
                ? "bg-[#25F4EE] text-black font-semibold hover:bg-[#25F4EE]/90"
                : "border-white/15 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"}`}
            >
              <Upload className="h-4 w-4 mr-2" />
              Unggah Video
            </Button>
            <Button
              type="button"
              onClick={() => setMode("tiktok")}
              aria-pressed={mode === "tiktok"}
              className={`h-11 ${mode === "tiktok"
                ? "bg-[#25F4EE] text-black font-semibold hover:bg-[#25F4EE]/90"
                : "border-white/15 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"}`}
            >
              <Link2 className="h-4 w-4 mr-2" />
              Link TikTok
            </Button>
          </div>

          {mode === "upload" ? (
            <div
              role="button"
              tabIndex={0}
              aria-label="Unggah video dari perangkat"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) loadFile(f);
              }}
              className={`rounded-2xl border-2 border-dashed px-4 py-8 sm:py-10 text-center cursor-pointer transition-colors ${
                dragOver
                  ? "border-[#25F4EE] bg-[#25F4EE]/10"
                  : "border-white/15 bg-white/[0.02] hover:border-white/35"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) loadFile(f);
                  e.target.value = "";
                }}
              />
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#25F4EE]/15">
                <Upload className="h-6 w-6 text-[#25F4EE]" />
              </div>
              <p className="mt-3 font-medium text-sm sm:text-base">
                Tarik &amp; lepas video ke sini, atau klik untuk memilih file
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                MP4, MOV, WebM • hingga 300 MB • diproses 100% di perangkat Anda (privat)
              </p>
            </div>
          ) : (
            <form onSubmit={analyzeTikTok} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                  value={tiktokUrl}
                  onChange={(e) => setTiktokUrl(e.target.value)}
                  placeholder="Tempel link video TikTok…"
                  className="pl-9 pr-10 h-12 bg-black/30 border-white/10 text-base text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-[#25F4EE]/50 focus-visible:border-[#25F4EE]/50"
                  inputMode="url"
                  autoComplete="off"
                  aria-label="Link TikTok untuk ekstrak frame"
                />
                {tiktokUrl && (
                  <button
                    type="button"
                    onClick={() => setTiktokUrl("")}
                    aria-label="Bersihkan link"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button
                type="submit"
                disabled={analyzing}
                className="h-12 px-6 font-semibold bg-[#FE2C55] hover:bg-[#FE2C55]/90 text-white shadow-lg shadow-[#FE2C55]/25"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Memuat…
                  </>
                ) : (
                  <>
                    <Film className="h-4 w-4 mr-2" /> Analisis
                  </>
                )}
              </Button>
            </form>
          )}

          {sourceError && (
            <div
              role="alert"
              className="rounded-xl border border-[#FE2C55]/30 bg-[#FE2C55]/10 px-4 py-3 text-sm text-[#ff8aa5]"
            >
              {sourceError}
            </div>
          )}

          {/* Active source summary */}
          {source && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-300">
              <Badge className="bg-[#25F4EE]/15 text-[#25F4EE] border border-[#25F4EE]/30 hover:bg-[#25F4EE]/15">
                {source.kind === "upload" ? "Unggahan" : "TikTok"}
              </Badge>
              <span className="truncate max-w-[16rem] sm:max-w-md" title={source.label}>
                {source.label}
              </span>
              {fmtBytes(source.sizeBytes) && (
                <span className="text-xs text-zinc-500">• {fmtBytes(source.sizeBytes)}</span>
              )}
              <button
                type="button"
                onClick={resetSource}
                className="ml-auto inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-[#FE2C55] transition-colors"
              >
                <RotateIcon /> Ganti video
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workspace */}
      {source && (
        <Card className="border-white/10 bg-white/[0.04] backdrop-blur rounded-2xl overflow-hidden">
          <CardContent className="p-4 sm:p-6">
            <div className="grid gap-6 md:grid-cols-[minmax(0,300px)_1fr]">
              {/* Video */}
              <div className="mx-auto w-full max-w-[300px] md:max-w-none">
                <video
                  ref={videoRef}
                  key={source.src}
                  src={source.src}
                  controls
                  playsInline
                  preload="auto"
                  onLoadedMetadata={onLoadedMetadata}
                  onError={onVideoError}
                  onTimeUpdate={onTimeUpdate}
                  className="w-full rounded-xl bg-black border border-white/10 object-contain"
                  style={{ aspectRatio: meta ? `${meta.width}/${meta.height}` : "9/16" }}
                />
                <p className="mt-2 text-center text-xs text-zinc-500">
                  Putar &amp; geser slider untuk memilih posisi frame manual
                </p>
              </div>

              {/* Controls */}
              <div className="min-w-0 space-y-5">
                {videoError ? (
                  <div
                    role="alert"
                    className="rounded-xl border border-[#FE2C55]/30 bg-[#FE2C55]/10 px-4 py-3 text-sm text-[#ff8aa5]"
                  >
                    {videoError}
                  </div>
                ) : !meta ? (
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Memuat metadata video…
                  </div>
                ) : (
                  <>
                    {compatNote && (
                      <div
                        role="status"
                        className="rounded-xl border border-[#25F4EE]/30 bg-[#25F4EE]/10 px-4 py-3 text-sm text-[#7ceee9] flex items-start gap-2"
                      >
                        <Info className="h-4 w-4 shrink-0 mt-0.5" />
                        {compatNote}
                      </div>
                    )}

                    {/* Metadata chips */}
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="border-white/15 text-zinc-300">
                        <Ruler className="h-3.5 w-3.5 mr-1.5 text-[#25F4EE]" />
                        {meta.width}×{meta.height} px (asli)
                      </Badge>
                      <Badge variant="outline" className="border-white/15 text-zinc-300">
                        <Clock3 className="h-3.5 w-3.5 mr-1.5 text-[#25F4EE]" />
                        {fmtDur(meta.duration)}
                      </Badge>
                      <Badge variant="outline" className="border-white/15 text-zinc-300">
                        <FileVideo className="h-3.5 w-3.5 mr-1.5 text-[#25F4EE]" />
                        {source.kind === "upload" ? "File lokal" : "Tanpa watermark"}
                      </Badge>
                    </div>

                    {/* Timeline scrubber */}
                    <div>
                      <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
                        <span>Posisi: {fmtDur(sliderT)}</span>
                        <span>Total: {fmtDur(meta.duration)}</span>
                      </div>
                      <Slider
                        value={[sliderT]}
                        max={meta.duration}
                        step={0.05}
                        aria-label="Posisi frame manual"
                        onValueChange={([val]) => {
                          setSliderT(val);
                          if (videoRef.current) videoRef.current.currentTime = val;
                        }}
                      />
                    </div>

                    {/* Settings */}
                    <div className="space-y-4">
                      {/* Extraction mode */}
                      <div>
                        <Label className="text-xs text-zinc-400 mb-1.5 block">Cara ekstraksi</Label>
                        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Mode ekstraksi frame">
                          {EXTRACT_MODES.map((m) => (
                            <button
                              key={m.value}
                              type="button"
                              onClick={() => setExtractMode(m.value)}
                              aria-pressed={extractMode === m.value}
                              className={`h-10 rounded-xl border text-xs sm:text-sm font-medium transition-colors ${
                                extractMode === m.value
                                  ? "bg-[#25F4EE] text-black border-[#25F4EE] shadow-lg shadow-[#25F4EE]/20"
                                  : "border-white/15 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"
                              }`}
                            >
                              {m.label}
                            </button>
                          ))}
                        </div>
                        <p className="mt-1.5 text-xs text-zinc-500">
                          {EXTRACT_MODES.find((m) => m.value === extractMode)?.hint}
                        </p>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        {/* Frequency control */}
                        <div>
                          {extractMode === "count" ? (
                            <>
                              <Label className="text-xs text-zinc-400 mb-1.5 block">Jumlah frame (disebar merata)</Label>
                              <Select value={frameCount} onValueChange={setFrameCount}>
                                <SelectTrigger className="bg-black/30 border-white/10 text-zinc-100 h-11">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-[#12121a] border-white/10 text-zinc-100">
                                  {FRAME_COUNTS.map((c) => (
                                    <SelectItem key={c} value={c}>
                                      {c} frame
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </>
                          ) : extractMode === "fps" ? (
                            <>
                              <Label className="text-xs text-zinc-400 mb-1.5 block">Frekuensi — frame per detik (FPS)</Label>
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {FPS_CHIPS.map((v) => (
                                  <Chip
                                    key={v}
                                    active={toNum(fpsVal, 0.1, 30, 1) === v}
                                    onClick={() => setFpsVal(String(v))}
                                  >
                                    {v} FPS{v === 1 ? " (per detik)" : ""}
                                  </Chip>
                                ))}
                              </div>
                              <div className="relative">
                                <Input
                                  type="number"
                                  inputMode="decimal"
                                  min={0.1}
                                  max={30}
                                  step={0.1}
                                  value={fpsVal}
                                  onChange={(e) => setFpsVal(e.target.value)}
                                  aria-label="FPS kustom (frame per detik)"
                                  className="h-11 pr-14 bg-black/30 border-white/10 text-zinc-100 focus-visible:ring-[#25F4EE]/50 focus-visible:border-[#25F4EE]/50"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">FPS</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <Label className="text-xs text-zinc-400 mb-1.5 block">Interval — 1 frame setiap…</Label>
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {INTERVAL_CHIPS.map((v) => (
                                  <Chip
                                    key={v}
                                    active={toNum(intervalVal, 0.5, 60, 5) === v}
                                    onClick={() => setIntervalVal(String(v))}
                                  >
                                    {v} detik
                                  </Chip>
                                ))}
                              </div>
                              <div className="relative">
                                <Input
                                  type="number"
                                  inputMode="decimal"
                                  min={0.5}
                                  max={60}
                                  step={0.5}
                                  value={intervalVal}
                                  onChange={(e) => setIntervalVal(e.target.value)}
                                  aria-label="Interval kustom dalam detik"
                                  className="h-11 pr-16 bg-black/30 border-white/10 text-zinc-100 focus-visible:ring-[#25F4EE]/50 focus-visible:border-[#25F4EE]/50"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">detik</span>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Format */}
                        <div>
                          <Label className="text-xs text-zinc-400 mb-1.5 block">Format gambar</Label>
                          <RadioGroup
                            value={format}
                            onValueChange={(v) => setFormat(v as ImgFormat)}
                            className="flex gap-4 h-11 items-center"
                          >
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="jpeg" id="fmt-jpg" className="border-white/30 text-[#25F4EE]" />
                              <Label htmlFor="fmt-jpg" className="text-sm text-zinc-300 cursor-pointer">
                                JPG (ringan)
                              </Label>
                            </div>
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value="png" id="fmt-png" className="border-white/30 text-[#25F4EE]" />
                              <Label htmlFor="fmt-png" className="text-sm text-zinc-300 cursor-pointer">
                                PNG (kualitas penuh)
                              </Label>
                            </div>
                          </RadioGroup>
                        </div>
                      </div>

                      {/* Live estimate */}
                      {est && (
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-zinc-400">
                            <Info className="h-3.5 w-3.5 text-[#25F4EE]" />
                            Perkiraan <b className="text-zinc-100">{est.ts.length} frame</b> dari {fmtDur(meta.duration)} • ±{" "}
                            {Math.max(1, Math.ceil(est.ts.length * 0.4))} detik proses
                          </span>
                          {est.truncated && (
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1.5 text-amber-300">
                              Dibatasi {MAX_FRAMES} frame pertama — perbesar interval / turunkan FPS untuk cakupan penuh
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        type="button"
                        onClick={extractAll}
                        disabled={extracting}
                        className="flex-1 h-12 font-semibold bg-[#FE2C55] hover:bg-[#FE2C55]/90 text-white shadow-lg shadow-[#FE2C55]/25"
                      >
                        {extracting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Mengekstrak…
                          </>
                        ) : (
                          <>
                            <Scissors className="h-4 w-4 mr-2" />
                            Ekstrak {est ? est.ts.length : frameCount} Frame
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        onClick={captureCurrent}
                        disabled={capturing || extracting}
                        variant="outline"
                        className="h-12 px-5 border-[#25F4EE]/40 text-[#25F4EE] bg-[#25F4EE]/5 hover:bg-[#25F4EE]/15 hover:text-[#25F4EE]"
                      >
                        {capturing ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Camera className="h-4 w-4 mr-2" />
                        )}
                        Ambil frame di posisi ini
                      </Button>
                    </div>

                    {extracting && (
                      <div className="space-y-1.5">
                        <Progress value={progress} className="h-2 bg-white/10 [&>div]:bg-gradient-to-r [&>div]:from-[#25F4EE] [&>div]:to-[#FE2C55]" />
                        <p className="text-xs text-zinc-500">{progressLabel}</p>
                      </div>
                    )}

                    <p className="text-xs text-zinc-500 flex items-center gap-1.5">
                      <Crop className="h-3.5 w-3.5" />
                      Frame diekstrak pada resolusi asli video — tidak di-resize.
                    </p>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {frames.length > 0 && (
        <Card className="border-white/10 bg-white/[0.04] backdrop-blur rounded-2xl">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <p className="font-semibold text-sm sm:text-base">
                Hasil Ekstraksi{" "}
                <span className="text-zinc-500 font-normal">({frames.length} frame)</span>
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={clearAllFrames}
                  className="h-9 text-zinc-400 hover:text-[#FE2C55] hover:bg-[#FE2C55]/10"
                >
                  <Trash2 className="h-4 w-4 mr-1.5" /> Hapus
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={downloadZip}
                  disabled={zipping}
                  className="h-9 bg-[#25F4EE] text-black font-semibold hover:bg-[#25F4EE]/90"
                >
                  {zipping ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <PackageOpen className="h-4 w-4 mr-1.5" />
                  )}
                  Download ZIP
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {frames.map((f) => (
                <figure
                  key={f.url}
                  className="group relative rounded-xl overflow-hidden border border-white/10 bg-black"
                >
                  <img
                    src={f.url}
                    alt={`Frame ${f.index + 1} pada ${fmtDur(f.time)}`}
                    className="w-full h-auto"
                    loading="lazy"
                  />
                  <figcaption className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/85 to-transparent px-2.5 pt-6 pb-2">
                    <span className="text-[11px] font-medium text-zinc-200">{fmtDur(f.time)}</span>
                    <button
                      type="button"
                      onClick={() => downloadFrame(f)}
                      aria-label={`Unduh frame ${f.index + 1}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 backdrop-blur text-white hover:bg-[#FE2C55] transition-colors"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </figcaption>
                </figure>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-7 px-2.5 rounded-lg text-xs font-medium border transition-colors ${
        active
          ? "bg-[#25F4EE] text-black border-[#25F4EE]"
          : "border-white/15 bg-white/5 text-zinc-400 hover:text-zinc-100 hover:border-white/30"
      }`}
    >
      {children}
    </button>
  );
}

function RotateIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { dlUrl, fmtBytes, fmtDur, fmtNum, safeName } from "@/lib/media";
import {
  ClipboardPaste,
  Download,
  Music,
  Copy,
  Check,
  Heart,
  MessageCircle,
  Play,
  Share2,
  Link2,
  Loader2,
  FileVideo,
  ImageIcon,
  X,
  Clock3,
} from "lucide-react";

type TikTokResult = {
  id: string;
  caption: string;
  duration: number | null;
  cover: string | null;
  author: { username: string; nickname: string; avatar: string | null };
  stats: {
    plays: number | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
  };
  music: { title: string; author: string; url: string | null };
  video: {
    noWatermark: string | null;
    noWatermarkHd: string | null;
    watermark: string | null;
    sizeNoWatermark: number | null;
    sizeHd: number | null;
    sizeWatermark: number | null;
  } | null;
  images: string[];
  isSlideshow: boolean;
};

type HistoryItem = {
  url: string;
  cover: string | null;
  username: string;
  caption: string;
  at: number;
};

const HISTORY_KEY = "toksave_history";

export default function DownloaderTool() {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const previewPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TikTokResult | null>(null);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [previewFallback, setPreviewFallback] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    return () => {
      if (previewPollRef.current) clearInterval(previewPollRef.current);
    };
  }, []);

  /** If the HD stream cannot be decoded (e.g. HEVC in browsers without support), fall back to the original H.264 stream */
  const onPreviewMeta = () => {
    const v = previewRef.current;
    if (!v) return;
    if (previewPollRef.current) clearInterval(previewPollRef.current);
    let tries = 0;
    previewPollRef.current = setInterval(() => {
      if (v.videoWidth) {
        if (previewPollRef.current) clearInterval(previewPollRef.current);
        previewPollRef.current = null;
        return;
      }
      tries += 1;
      if (tries >= 10) {
        if (previewPollRef.current) clearInterval(previewPollRef.current);
        previewPollRef.current = null;
        setPreviewFallback(true);
      }
    }, 250);
  };

  const pushHistory = useCallback((item: HistoryItem) => {
    setHistory((prev) => {
      const next = [item, ...prev.filter((h) => h.url !== item.url)].slice(0, 6);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const handleAnalyze = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const val = url.trim();
    if (!val) {
      setError("Masukkan link TikTok terlebih dahulu.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setCopiedCaption(false);
    setCopiedLink(false);
    setPreviewFallback(false);
    try {
      const res = await fetch("/api/tiktok/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: val }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Gagal memproses link. Coba lagi.");
        return;
      }
      const r = data as TikTokResult;
      setResult(r);
      pushHistory({
        url: val,
        cover: r.cover || r.images[0] || null,
        username: r.author.username,
        caption: r.caption,
        at: Date.now(),
      });
      toast({ title: "Video ditemukan!", description: "Silakan pilih format unduhan di bawah." });
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setUrl(text.trim());
        inputRef.current?.focus();
      } else {
        toast({ title: "Clipboard kosong", description: "Salin dulu link TikTok dari aplikasi." });
      }
    } catch {
      toast({
        title: "Tidak bisa mengakses clipboard",
        description: "Tempel manual dengan Ctrl+V / tahan lalu Tempel di kolom link.",
        variant: "destructive",
      });
      inputRef.current?.focus();
    }
  };

  const copyCaption = async () => {
    if (!result?.caption) {
      toast({ title: "Tidak ada caption", description: "Video ini tidak memiliki caption." });
      return;
    }
    try {
      await navigator.clipboard.writeText(result.caption);
      setCopiedCaption(true);
      toast({ title: "Caption disalin!", description: "Sudah siap ditempel di mana saja." });
      setTimeout(() => setCopiedCaption(false), 2500);
    } catch {
      toast({
        title: "Gagal menyalin",
        description: "Browser memblokir clipboard. Salin manual dari kotak caption.",
        variant: "destructive",
      });
    }
  };

  const copyDirectLink = async () => {
    const link = result?.video?.noWatermarkHd || result?.video?.noWatermark;
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      toast({ title: "Link video disalin!", description: "Link langsung tanpa watermark." });
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      toast({ title: "Gagal menyalin link", variant: "destructive" });
    }
  };

  const reset = () => {
    setUrl("");
    setResult(null);
    setError(null);
    inputRef.current?.focus();
  };

  const baseName = result
    ? `tiktok_${result.author.username ? "@" + safeName(result.author.username) + "_" : ""}${result.id || safeName(result.caption) || Date.now()}`
    : "tiktok";
  const previewSrc =
    !previewFallback && result?.video?.noWatermarkHd
      ? result.video.noWatermarkHd
      : result?.video?.noWatermark || result?.video?.noWatermarkHd || null;

  return (
    <div className="space-y-6">
      {/* Input card */}
      <section aria-label="Form link TikTok">
        <Card className="border-white/10 bg-white/[0.04] backdrop-blur rounded-2xl">
          <CardContent className="p-4 sm:p-6">
            <form onSubmit={handleAnalyze} className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    ref={inputRef}
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Tempel link TikTok di sini… (contoh: https://vt.tiktok.com/…)"
                    className="pl-9 pr-10 h-12 bg-black/30 border-white/10 text-base text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-[#25F4EE]/50 focus-visible:border-[#25F4EE]/50"
                    inputMode="url"
                    autoComplete="off"
                    aria-label="Link TikTok"
                  />
                  {url && (
                    <button
                      type="button"
                      onClick={reset}
                      aria-label="Bersihkan"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePaste}
                    className="h-12 px-4 border-white/15 bg-white/5 hover:bg-white/10 hover:text-white"
                    aria-label="Tempel dari clipboard"
                  >
                    <ClipboardPaste className="h-4 w-4 mr-0 sm:mr-2" />
                    <span className="hidden sm:inline">Tempel</span>
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="h-12 px-6 flex-1 sm:flex-none font-semibold bg-[#FE2C55] hover:bg-[#FE2C55]/90 text-white shadow-lg shadow-[#FE2C55]/25"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Memproses…
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-zinc-500">
                Tips: di aplikasi TikTok, tekan <span className="text-zinc-300">Bagikan → Salin link</span>, lalu tempel di sini.
              </p>
            </form>

            {error && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-[#FE2C55]/30 bg-[#FE2C55]/10 px-4 py-3 text-sm text-[#ff8aa5]"
              >
                {error}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Loading skeleton */}
      {loading && (
        <section className="mt-8" aria-busy="true" aria-label="Memuat video">
          <Card className="border-white/10 bg-white/[0.03] rounded-2xl">
            <CardContent className="p-4 sm:p-6">
              <div className="grid gap-6 md:grid-cols-[minmax(0,280px)_1fr]">
                <Skeleton className="aspect-[9/16] w-full max-w-[280px] rounded-xl bg-white/10" />
                <div className="space-y-4">
                  <Skeleton className="h-12 w-3/4 rounded-lg bg-white/10" />
                  <Skeleton className="h-20 w-full rounded-lg bg-white/10" />
                  <div className="flex gap-3">
                    <Skeleton className="h-10 w-24 rounded-lg bg-white/10" />
                    <Skeleton className="h-10 w-24 rounded-lg bg-white/10" />
                    <Skeleton className="h-10 w-24 rounded-lg bg-white/10" />
                  </div>
                  <Skeleton className="h-12 w-full rounded-lg bg-white/10" />
                  <Skeleton className="h-12 w-full rounded-lg bg-white/10" />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Result */}
      {result && !loading && (
        <section className="mt-8" aria-label="Hasil">
          <Card className="border-white/10 bg-white/[0.04] backdrop-blur rounded-2xl overflow-hidden">
            <CardContent className="p-4 sm:p-6">
              <div className="grid gap-6 md:grid-cols-[minmax(0,280px)_1fr]">
                {/* Preview */}
                <div className="mx-auto w-full max-w-[280px] md:max-w-none">
                  {result.isSlideshow ? (
                    <div className="aspect-[9/16] rounded-xl overflow-hidden bg-black border border-white/10 flex items-center justify-center">
                      <img
                        src={dlUrl(result.images[0], `${baseName}_img1.jpg`, true)}
                        alt="Slide pertama"
                        className="h-full w-full object-contain"
                      />
                    </div>
                  ) : previewSrc ? (
                    <video
                      ref={previewRef}
                      key={result.id + (previewFallback ? "-fb" : "")}
                      controls
                      playsInline
                      preload="metadata"
                      onLoadedMetadata={onPreviewMeta}
                      poster={
                        result.cover ? dlUrl(result.cover, `${baseName}_cover.jpg`, true) : undefined
                      }
                      src={dlUrl(previewSrc, "preview.mp4", true)}
                      className="aspect-[9/16] w-full rounded-xl bg-black border border-white/10 object-contain"
                    />
                  ) : (
                    <div className="aspect-[9/16] rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-500">
                      <FileVideo className="h-10 w-10" />
                    </div>
                  )}
                  {result.duration != null && fmtDur(result.duration) && (
                    <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-zinc-400">
                      <Clock3 className="h-3.5 w-3.5" /> Durasi {fmtDur(result.duration)}
                      {result.video?.sizeHd && fmtBytes(result.video.sizeHd)
                        ? ` • ${fmtBytes(result.video.sizeHd)} (HD)`
                        : ""}
                    </div>
                  )}
                </div>

                {/* Info & actions */}
                <div className="min-w-0 space-y-5">
                  {/* Author */}
                  <div className="flex items-center gap-3">
                    {result.author.avatar ? (
                      <img
                        src={dlUrl(result.author.avatar, "avatar.jpg", true)}
                        alt={`Avatar ${result.author.nickname || result.author.username}`}
                        className="h-11 w-11 rounded-full border border-white/15 object-cover"
                      />
                    ) : (
                      <div className="h-11 w-11 rounded-full bg-white/10" />
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold truncate">
                        {result.author.nickname || result.author.username || "Pengguna TikTok"}
                      </p>
                      <p className="text-sm text-[#25F4EE] truncate">
                        {result.author.username ? `@${result.author.username}` : ""}
                      </p>
                    </div>
                  </div>

                  {/* Caption */}
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                        Caption
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        onClick={copyCaption}
                        variant="outline"
                        className="h-8 px-3 text-xs border-[#25F4EE]/40 text-[#25F4EE] bg-[#25F4EE]/5 hover:bg-[#25F4EE]/15 hover:text-[#25F4EE]"
                        aria-label="Salin caption"
                      >
                        {copiedCaption ? (
                          <>
                            <Check className="h-3.5 w-3.5 mr-1.5" /> Tersalin
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy Caption
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-200 whitespace-pre-wrap break-words max-h-32 overflow-y-auto pretty-scrollbar">
                      {result.caption || "(Video ini tidak memiliki caption)"}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { icon: Play, label: "Dilihat", value: result.stats.plays },
                      { icon: Heart, label: "Suka", value: result.stats.likes },
                      { icon: MessageCircle, label: "Komentar", value: result.stats.comments },
                      { icon: Share2, label: "Dibagikan", value: result.stats.shares },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-center"
                      >
                        <s.icon className="mx-auto h-4 w-4 text-zinc-500" />
                        <p className="mt-1 text-sm font-semibold">{fmtNum(s.value)}</p>
                        <p className="text-[11px] text-zinc-500">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Music */}
                  {result.music.title && (
                    <div className="flex items-center gap-2.5 text-sm text-zinc-400">
                      <Music className="h-4 w-4 shrink-0 text-[#FE2C55]" />
                      <span className="truncate">
                        {result.music.title}
                        {result.music.author ? ` — ${result.music.author}` : ""}
                      </span>
                    </div>
                  )}

                  <Separator className="bg-white/10" />

                  {/* Downloads */}
                  <div>
                    <p className="mb-3 text-sm font-semibold">Pilih format unduhan</p>
                    <div className="space-y-2.5">
                      {result.isSlideshow ? (
                        <>
                          {result.images.map((img, i) => (
                            <a
                              key={img}
                              href={dlUrl(img, `${baseName}_img${i + 1}.jpg`)}
                              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm hover:bg-white/[0.08] transition-colors"
                              download
                            >
                              <span className="flex items-center gap-2.5">
                                <ImageIcon className="h-4 w-4 text-[#25F4EE]" />
                                Gambar {i + 1}
                              </span>
                              <Download className="h-4 w-4 text-zinc-400" />
                            </a>
                          ))}
                          {result.music.url && (
                            <a
                              href={dlUrl(result.music.url, `${baseName}.mp3`)}
                              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm hover:bg-white/[0.08] transition-colors"
                              download
                            >
                              <span className="flex items-center gap-2.5">
                                <Music className="h-4 w-4 text-[#FE2C55]" />
                                Audio MP3
                              </span>
                              <Download className="h-4 w-4 text-zinc-400" />
                            </a>
                          )}
                        </>
                      ) : (
                        <>
                          {result.video?.noWatermarkHd && (
                            <a
                              href={dlUrl(
                                result.video.noWatermarkHd,
                                `${baseName}_nowm_hd.mp4`
                              )}
                              download
                              className="flex items-center justify-between rounded-xl bg-gradient-to-r from-[#FE2C55] to-[#ff5c7a] px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#FE2C55]/25 hover:opacity-90 transition-opacity"
                            >
                              <span className="flex items-center gap-2.5">
                                <FileVideo className="h-4 w-4" />
                                MP4 Tanpa Watermark — HD
                              </span>
                              <span className="text-xs font-normal opacity-90">
                                {fmtBytes(result.video.sizeHd) || "Terbaik"} • Download
                              </span>
                            </a>
                          )}
                          {result.video?.noWatermark && (
                            <a
                              href={dlUrl(result.video.noWatermark, `${baseName}_nowm.mp4`)}
                              download
                              className="flex items-center justify-between rounded-xl border border-[#25F4EE]/35 bg-[#25F4EE]/10 px-4 py-3.5 text-sm font-medium text-[#25F4EE] hover:bg-[#25F4EE]/15 transition-colors"
                            >
                              <span className="flex items-center gap-2.5">
                                <FileVideo className="h-4 w-4" />
                                MP4 Tanpa Watermark — Original
                              </span>
                              <span className="text-xs opacity-90">
                                {fmtBytes(result.video.sizeNoWatermark) || ""} • Download
                              </span>
                            </a>
                          )}
                          {result.video?.watermark && (
                            <a
                              href={dlUrl(result.video.watermark, `${baseName}_wm.mp4`)}
                              download
                              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm hover:bg-white/[0.08] transition-colors"
                            >
                              <span className="flex items-center gap-2.5 text-zinc-300">
                                <FileVideo className="h-4 w-4" />
                                MP4 Dengan Watermark
                              </span>
                              <span className="text-xs text-zinc-500">
                                {fmtBytes(result.video.sizeWatermark) || ""} • Download
                              </span>
                            </a>
                          )}
                          {result.music.url && (
                            <a
                              href={dlUrl(result.music.url, `${baseName}.mp3`)}
                              download
                              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm hover:bg-white/[0.08] transition-colors"
                            >
                              <span className="flex items-center gap-2.5 text-zinc-300">
                                <Music className="h-4 w-4 text-[#FE2C55]" />
                                Audio MP3
                              </span>
                              <Download className="h-4 w-4 text-zinc-400" />
                            </a>
                          )}
                        </>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {(result.video?.noWatermarkHd || result.video?.noWatermark) && (
                        <button
                          type="button"
                          onClick={copyDirectLink}
                          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-[#25F4EE] transition-colors"
                        >
                          {copiedLink ? (
                            <>
                              <Check className="h-3.5 w-3.5" /> Link disalin
                            </>
                          ) : (
                            <>
                              <Link2 className="h-3.5 w-3.5" /> Salin tautan langsung video
                            </>
                          )}
                        </button>
                      )}
                      <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                        <Download className="h-3.5 w-3.5" /> File asli dari CDN TikTok — tanpa kompresi ulang
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* History */}
      {history.length > 0 && !loading && (
        <section className="mt-8" aria-label="Riwayat">
          <h2 className="text-sm font-semibold text-zinc-400 mb-3">Riwayat terakhir</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 pretty-scrollbar">
            {history.map((h) => (
              <button
                key={h.url + h.at}
                type="button"
                onClick={() => {
                  setUrl(h.url);
                  inputRef.current?.focus();
                }}
                className="group shrink-0 w-40 text-left rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden hover:border-white/25 transition-colors"
              >
                <div className="aspect-video bg-black/40 overflow-hidden">
                  {h.cover ? (
                    <img
                      src={dlUrl(h.cover, "thumb.jpg", true)}
                      alt={h.caption || "Video"}
                      className="h-full w-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-zinc-600">
                      <Play className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium text-[#25F4EE] truncate">
                    {h.username ? `@${h.username}` : "TikTok"}
                  </p>
                  <p className="text-[11px] text-zinc-500 line-clamp-1">{h.caption || "(tanpa caption)"}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Steps */}
      <section className="mt-10 mb-4" aria-label="Cara pakai">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: ClipboardPaste,
              title: "1. Salin link",
              desc: "Buka TikTok, tekan Bagikan lalu Salin link video.",
              color: "text-[#25F4EE]",
            },
            {
              icon: Download,
              title: "2. Tempel & proses",
              desc: "Tempel link di kolom atas, klik Download, tunggu 2 detik.",
              color: "text-[#FE2C55]",
            },
            {
              icon: Check,
              title: "3. Simpan & copy caption",
              desc: "Pilih MP4 tanpa watermark, caption siap dicopy sekali klik.",
              color: "text-[#25F4EE]",
            },
          ].map((s) => (
            <div
              key={s.title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"
            >
              <s.icon className={`h-5 w-5 ${s.color}`} />
              <p className="mt-3 font-semibold text-sm">{s.title}</p>
              <p className="mt-1 text-sm text-zinc-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

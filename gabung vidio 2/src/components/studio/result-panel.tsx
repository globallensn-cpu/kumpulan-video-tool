"use client"

import * as React from "react"
import { motion } from "framer-motion"
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  Download,
  FileVideo,
  Hash,
  Keyboard,
  Lightbulb,
  ListChecks,
  RotateCcw,
  ScanText,
  Sparkles,
  Type,
} from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CopyButton } from "./copy-button"
import { SeoChecklist } from "./seo-checklist"
import { formatBytes, formatDuration } from "@/lib/format"
import type { JobDTO } from "@/lib/types"

function ScoreRing({ score }: { score: number }) {
  const r = 30
  const c = 2 * Math.PI * r
  const val = Math.min(100, Math.max(0, Math.round(score)))
  return (
    <div className="relative h-[84px] w-[84px] shrink-0" role="img" aria-label={`Skor SEO ${val} dari 100`}>
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#27272a" strokeWidth="7" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="url(#tokforge-grad)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - val / 100)}
        />
        <defs>
          <linearGradient id="tokforge-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FE2C55" />
            <stop offset="100%" stopColor="#25F4EE" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="text-[22px] font-bold leading-none text-zinc-100">{val}</div>
          <div className="mt-1 text-[8px] font-medium uppercase tracking-widest text-zinc-500">Skor SEO</div>
        </div>
      </div>
    </div>
  )
}

function MetaBlock({
  icon,
  title,
  hint,
  copyText,
  children,
}: {
  icon: React.ReactNode
  title: string
  hint?: string
  copyText: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
          {icon}
          {title}
          {hint && <span className="font-normal text-zinc-600">· {hint}</span>}
        </div>
        <CopyButton text={copyText} label="Salin" className="h-9 px-3" />
      </div>
      {children}
    </div>
  )
}

export function ResultPanel({
  job,
  onReset,
  onRetrySame,
}: {
  job: JobDTO
  onReset: () => void
  onRetrySame: () => void
}) {
  const meta = job.metadata
  const specs = job.specs
  const [videoError, setVideoError] = React.useState(false)

  const fullMetadata = meta
    ? `${meta.title}\n\n${meta.caption}\n\n${meta.hashtags.map((h) => `#${h}`).join(" ")}`
    : ""

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      aria-label="Hasil akhir video dan metadata"
      className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/50 shadow-2xl shadow-black/40"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 bg-gradient-to-r from-[#FE2C55]/10 via-transparent to-[#25F4EE]/5 p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/15">
            <BadgeCheck className="h-6 w-6 text-emerald-400" />
          </span>
          <div>
            <h2 className="text-base font-bold sm:text-lg">Video Final Siap Upload 🎉</h2>
            <p className="text-xs text-zinc-500">
              Encode TikTok-spec selesai · metadata SEO tersusun dari analisis AI
            </p>
          </div>
        </div>
        {meta && <ScoreRing score={meta.seoScore} />}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(300px,380px)_1fr]">
        {/* Kolom kiri: player + unduh */}
        <div className="flex flex-col items-center border-b border-zinc-800 p-4 sm:p-6 lg:border-b-0 lg:border-r">
          <div className="relative w-full max-w-[280px]">
            <div className="overflow-hidden rounded-2xl border border-zinc-700 bg-black shadow-2xl shadow-black/60">
              {videoError ? (
                <div className="grid aspect-[9/16] w-full place-items-center bg-black p-4 text-center">
                  <div>
                    <AlertTriangle className="mx-auto h-6 w-6 text-amber-400" />
                    <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                      Video gagal dimuat — file mungkin sudah dibersihkan. Jalankan ulang pipeline
                      untuk membuatnya kembali.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 h-9"
                      onClick={() => setVideoError(false)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Coba lagi
                    </Button>
                  </div>
                </div>
              ) : (
                <video
                  src={job.videoUrl}
                  controls
                  playsInline
                  preload="metadata"
                  onError={() => setVideoError(true)}
                  className="aspect-[9/16] w-full bg-black object-contain"
                />
              )}
            </div>
            <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 font-mono text-[10px] text-[#25F4EE] backdrop-blur">
              {specs ? `${specs.width}×${specs.height}` : "1080×1920"} · H.264
            </span>
          </div>

          {specs && (
            <div className="mt-4 flex flex-wrap justify-center gap-1.5 text-[10px]">
              <Badge variant="outline" className="border-zinc-700 bg-zinc-900 font-mono text-zinc-400">
                {formatDuration(specs.duration)}
              </Badge>
              <Badge variant="outline" className="border-zinc-700 bg-zinc-900 font-mono text-zinc-400">
                {formatBytes(specs.size)}
              </Badge>
              <Badge variant="outline" className="border-zinc-700 bg-zinc-900 font-mono text-zinc-400">
                ±{Math.round(specs.bitrateKbps / 1000)} Mbps
              </Badge>
              <Badge variant="outline" className="border-zinc-700 bg-zinc-900 font-mono text-zinc-400">
                {specs.fps} fps
              </Badge>
              <Badge variant="outline" className="border-zinc-700 bg-zinc-900 font-mono text-emerald-400/80">
                faststart ✓
              </Badge>
            </div>
          )}

          <Button
            asChild
            size="lg"
            className="mt-5 h-12 w-full gap-2 rounded-xl bg-gradient-to-r from-[#FE2C55] to-[#FF6B3D] text-sm font-bold text-white shadow-lg shadow-[#FE2C55]/25 hover:brightness-110"
          >
            <a href={job.downloadUrl} download>
              <Download className="h-4.5 w-4.5" />
              Unduh MP4 — Siap Upload
            </a>
          </Button>
          <p className="mt-2 flex items-center gap-1.5 text-center text-[10px] text-zinc-600">
            <FileVideo className="h-3 w-3" />
            Nama file otomatis bersih dari judul SEO
          </p>
        </div>

        {/* Kolom kanan: metadata */}
        <div className="space-y-4 p-4 sm:p-6">
          {meta ? (
            <>
              {/* Judul */}
              <MetaBlock
                icon={<Type className="h-3.5 w-3.5 text-[#FF6B85]" />}
                title="Judul / Hook"
                hint={`${meta.title.length}/90 karakter`}
                copyText={meta.title}
              >
                <p className="text-sm font-semibold leading-relaxed text-zinc-100">{meta.title}</p>
              </MetaBlock>

              {/* Caption */}
              <MetaBlock
                icon={<Keyboard className="h-3.5 w-3.5 text-[#FF6B85]" />}
                title="Caption"
                hint="keyword-first + CTA"
                copyText={meta.caption}
              >
                <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-300">{meta.caption}</p>
              </MetaBlock>

              {/* Hashtag */}
              <MetaBlock
                icon={<Hash className="h-3.5 w-3.5 text-[#25F4EE]" />}
                title="Hashtag"
                hint={`${meta.hashtags.length} tag · broad + niche`}
                copyText={meta.hashtags.map((h) => `#${h}`).join(" ")}
              >
                <div className="flex flex-wrap gap-1.5">
                  {meta.hashtags.map((h) => (
                    <span
                      key={h}
                      className="rounded-full border border-[#25F4EE]/25 bg-[#25F4EE]/10 px-2.5 py-1 text-xs font-medium text-[#5ff5ec]"
                    >
                      #{h}
                    </span>
                  ))}
                </div>
              </MetaBlock>

              {/* Keyword */}
              <MetaBlock
                icon={<Sparkles className="h-3.5 w-3.5 text-[#25F4EE]" />}
                title="Keyword Pencarian"
                hint="untuk caption & lisan"
                copyText={meta.keywords.join(", ")}
              >
                <div className="flex flex-wrap gap-1.5">
                  {meta.keywords.map((k) => (
                    <span
                      key={k}
                      className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-400"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              </MetaBlock>

              {/* Overlay */}
              <MetaBlock
                icon={<ScanText className="h-3.5 w-3.5 text-[#FF6B85]" />}
                title="Saran Teks Overlay"
                hint="dibaca OCR TikTok"
                copyText={meta.overlays.join(" | ")}
              >
                <ol className="space-y-1.5">
                  {meta.overlays.map((o, i) => (
                    <li key={o} className="flex items-center gap-2 text-xs text-zinc-300">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#FE2C55]/15 font-mono text-[10px] font-bold text-[#FF6B85]">
                        {i + 1}
                      </span>
                      “{o}”
                    </li>
                  ))}
                </ol>
              </MetaBlock>

              {/* Copy all */}
              <Button
                size="lg"
                variant="secondary"
                className="h-12 w-full gap-2 whitespace-normal rounded-xl border border-[#25F4EE]/30 bg-[#25F4EE]/10 text-sm font-bold text-[#5ff5ec] hover:bg-[#25F4EE]/20"
                onClick={() => void navigator.clipboard.writeText(fullMetadata)}
              >
                <Check className="h-4 w-4" />
                Salin Semua Metadata (paste langsung ke TikTok)
              </Button>

              <SeoChecklist job={job} />

              {/* Analisis & tips */}
              <Accordion type="multiple" className="w-full">
                {job.contentSummary && (
                  <AccordionItem value="analysis" className="border-zinc-800">
                    <AccordionTrigger className="py-3 text-xs font-semibold text-zinc-300 hover:no-underline">
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-[#25F4EE]" /> Hasil Analisis Konten AI
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="pb-3">
                      <p className="whitespace-pre-line text-[11px] leading-relaxed text-zinc-400">
                        {job.contentSummary}
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                )}
                {meta.seoTips.length > 0 && (
                  <AccordionItem value="tips" className="border-zinc-800">
                    <AccordionTrigger className="py-3 text-xs font-semibold text-zinc-300 hover:no-underline">
                      <span className="flex items-center gap-2">
                        <Lightbulb className="h-3.5 w-3.5 text-amber-400" /> Tips SEO dari AI ({meta.seoTips.length})
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="pb-3">
                      <ul className="space-y-2">
                        {meta.seoTips.map((t, i) => (
                          <li key={t} className="flex items-start gap-2 text-[11px] leading-relaxed text-zinc-400">
                            <ListChecks className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400/80" />
                            {t}
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </>
          ) : (
            <p className="text-sm text-zinc-500">Metadata tidak tersedia.</p>
          )}

          {/* Aksi akhir */}
          <div className="flex flex-col gap-2 border-t border-zinc-800 pt-4 sm:flex-row">
            <Button variant="outline" onClick={onRetrySame} className="h-11 flex-1 gap-1.5 text-xs">
              <RotateCcw className="h-3.5 w-3.5" /> Ulangi (klip sama)
            </Button>
            <Button variant="secondary" onClick={onReset} className="h-11 flex-1 gap-1.5 text-xs">
              <Sparkles className="h-3.5 w-3.5" /> Batch Baru (reset semua)
            </Button>
          </div>
        </div>
      </div>
    </motion.section>
  )
}

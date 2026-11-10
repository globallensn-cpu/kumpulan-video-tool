"use client"

import * as React from "react"
import { AlertCircle, Ban, Check, Loader2, Sparkles, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Terminal } from "./terminal"
import { cn } from "@/lib/utils"
import { formatDuration } from "@/lib/format"
import type { JobDTO, JobStage } from "@/lib/types"
import { ASPECT_OPTIONS, QUALITY_PRESETS } from "@/lib/tiktok-specs"

const STAGES: { key: JobStage; title: string; desc: string }[] = [
  { key: "prepare", title: "Persiapan", desc: "Validasi klip & filter FFmpeg" },
  { key: "encode", title: "Gabung & Encode", desc: "FFmpeg · H.264 1080×1920 · single-generation" },
  { key: "analyze", title: "Analisis Konten AI", desc: "Model vision memahami isi video" },
  { key: "metadata", title: "Metadata SEO AI", desc: "Judul, caption, hashtag, keyword" },
]

export function ProcessPanel({
  job,
  starting,
  clipCount,
  totalDuration,
  onStart,
  onCancel,
}: {
  job: JobDTO | null
  starting: boolean
  clipCount: number
  totalDuration: number
  onStart: () => void
  onCancel: () => void
}) {
  const processing = job?.status === "processing" || job?.status === "queued"
  const stageIndex = job ? STAGES.findIndex((s) => s.key === job.stage) : -1
  const aspectLabel = ASPECT_OPTIONS.find((a) => a.value === job?.settings?.aspect)?.title
  const qualityLabel = job?.settings ? QUALITY_PRESETS[job.settings.quality].label : null

  return (
    <section aria-label="Eksekusi pipeline" className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2.5 text-sm font-semibold">
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-[#FE2C55]/15 text-[11px] font-bold text-[#FF6B85]">
            4
          </span>
          Gabung &amp; Encode
        </h2>
        {job?.settings && (
          <span className="hidden text-[11px] text-zinc-500 sm:block">
            {qualityLabel} · {job.settings.fps} fps · {aspectLabel}
          </span>
        )}
      </div>

      {/* ============ TAMPILAN IDLE / ERROR / CANCELED ============ */}
      {!processing && (
        <div className="space-y-4">
          {job?.status === "error" && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-xs text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Pipeline gagal</p>
                <p className="mt-0.5 text-red-300/80">{job.error}</p>
              </div>
            </div>
          )}
          {job?.status === "canceled" && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-xs text-amber-300">
              <Ban className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Proses dibatalkan. Kamu bisa mencoba lagi kapan saja.</p>
            </div>
          )}

          <Button
            size="lg"
            disabled={clipCount === 0 || starting}
            onClick={onStart}
            className="h-14 w-full gap-2.5 whitespace-normal rounded-xl bg-gradient-to-r from-[#FE2C55] to-[#FF6B3D] px-4 text-base font-bold text-white shadow-lg shadow-[#FE2C55]/25 transition-all hover:shadow-xl hover:shadow-[#FE2C55]/35 hover:brightness-110 disabled:opacity-40 disabled:shadow-none sm:px-6"
          >
            {starting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> Menyiapkan pipeline…
              </>
            ) : (
              <>
                <Zap className="h-5 w-5" fill="currentColor" />
                {clipCount === 0 ? "Unggah klip dulu untuk mulai" : "Gabung & Encode Sekarang"}
              </>
            )}
          </Button>

          {clipCount > 0 && (
            <p className="text-center text-[11px] leading-relaxed text-zinc-500">
              1 klik: normalisasi {clipCount} klip → penggabungan → encode H.264 TikTok-spec → AI metadata SEO.
              <br />
              Estimasi durasi output: <span className="font-mono text-zinc-400">{formatDuration(totalDuration)}</span>
            </p>
          )}
        </div>
      )}

      {/* ============ TAMPILAN PROCESSING ============ */}
      {processing && job && (
        <div className="space-y-4">
          {/* Timeline tahap */}
          <ol className="space-y-2.5">
            {STAGES.map((s, i) => {
              const done = i < stageIndex || job.status === "done"
              const active = i === stageIndex
              return (
                <li key={s.key} className="flex items-center gap-3">
                  <span
                    className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs transition-colors",
                      done
                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                        : active
                          ? "border-[#FE2C55]/60 bg-[#FE2C55]/15 text-[#FF6B85]"
                          : "border-zinc-800 bg-zinc-900 text-zinc-600"
                    )}
                  >
                    {done ? (
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    ) : active ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-xs font-semibold", done ? "text-emerald-400" : active ? "text-zinc-100" : "text-zinc-600")}>
                      {s.title}
                    </p>
                    <p className="truncate text-[10px] text-zinc-500">{s.desc}</p>
                  </div>
                  {active && (
                    <span className="shrink-0 font-mono text-xs font-bold text-[#FF6B85]">{job.progress}%</span>
                  )}
                </li>
              )
            })}
          </ol>

          {/* Progress bar keseluruhan */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5 font-medium text-zinc-300">
                <Sparkles className="h-3 w-3 text-[#25F4EE]" />
                {job.stage === "analyze"
                  ? "AI sedang menonton videomu…"
                  : job.stage === "metadata"
                    ? "AI sedang menulis metadata SEO…"
                    : "FFmpeg sedang bekerja…"}
              </span>
              <span className="font-mono text-zinc-500">{job.progress}%</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#FE2C55] via-[#FF6B3D] to-[#25F4EE] transition-all duration-500"
                style={{ width: `${Math.max(job.progress, 2)}%` }}
                role="progressbar"
                aria-valuenow={job.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Kemajuan pipeline"
              />
            </div>
          </div>

          {/* Terminal log */}
          <Terminal logs={job.logs} live />

          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="h-11 w-full gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
          >
            <Ban className="h-3.5 w-3.5" /> Batalkan Proses
          </Button>
        </div>
      )}
    </section>
  )
}

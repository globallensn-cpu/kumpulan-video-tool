"use client"

import { AudioLines, Clock3, Hash, ScanText, TrendingUp, Workflow } from "lucide-react"
import type { JobSettings } from "@/lib/types"
import { ALGORITHM_FACTS, activeSpecRows } from "@/lib/tiktok-specs"

const FACT_ICONS = [Clock3, TrendingUp, ScanText, AudioLines]

const PIPELINE_STEPS = [
  "Upload klip (ffprobe otomatis)",
  "FFmpeg gabung + encode",
  "AI vision analisis konten",
  "LLM metadata SEO",
  "Unduh & upload ke TikTok",
]

export function SpecSidebar({ settings }: { settings: JobSettings }) {
  const rows = activeSpecRows(settings)

  return (
    <aside className="space-y-5" aria-label="Informasi riset dan spesifikasi">
      {/* Spesifikasi encode aktif */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-6">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Workflow className="h-4 w-4 text-[#25F4EE]" />
          Spesifikasi Encode Aktif
        </h3>
        <p className="mt-1 text-[11px] text-zinc-500">
          Terkunci ke standar unggah TikTok/Douyin — mengikuti setting-mu secara dinamis.
        </p>
        <dl className="mt-3 space-y-2">
          {rows.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-3 text-[11px]">
              <dt className="shrink-0 text-zinc-500">{r.label}</dt>
              <dd className="text-right font-mono text-zinc-300">{r.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 border-t border-zinc-800 pt-2.5 text-[10px] leading-relaxed text-zinc-600">
          Sumber riset: TikTok Help &amp; panduan bitrate 2025 · Douyin 抖音创作者 · pola ekspor CapCut/剪映
          (timescale 15360) · dokumentasi FFmpeg.
        </p>
      </div>

      {/* Cara algoritma membaca video */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-6">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Hash className="h-4 w-4 text-[#FF6B85]" />
          Cara Algoritma TikTok Membaca Videomu
        </h3>
        <ul className="mt-3 space-y-3">
          {ALGORITHM_FACTS.map((f, i) => {
            const Icon = FACT_ICONS[i % FACT_ICONS.length]
            return (
              <li key={f.title} className="flex gap-2.5">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-[#FE2C55]/10">
                  <Icon className="h-3.5 w-3.5 text-[#FF6B85]" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-zinc-200">{f.title}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">{f.detail}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Alur pipeline */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-6">
        <h3 className="text-sm font-semibold">Alur 1-Klik</h3>
        <ol className="mt-3">
          {PIPELINE_STEPS.map((s, i) => (
            <li
              key={s}
              className="relative flex items-center gap-2.5 pb-5 text-[11px] text-zinc-400 last:pb-0"
            >
              <span className="z-10 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-zinc-700 bg-zinc-900 font-mono text-[9px] text-zinc-500">
                {i + 1}
              </span>
              {s}
              {i < PIPELINE_STEPS.length - 1 && (
                <span
                  aria-hidden
                  className="absolute left-[9.5px] top-[26px] h-[calc(100%-26px)] w-px bg-zinc-800"
                />
              )}
            </li>
          ))}
        </ol>
      </div>
    </aside>
  )
}

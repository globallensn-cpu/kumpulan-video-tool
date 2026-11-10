"use client"

import { AlertTriangle, CheckCircle2 } from "lucide-react"
import type { JobDTO } from "@/lib/types"
import { cn } from "@/lib/utils"

export function SeoChecklist({ job }: { job: JobDTO }) {
  const specs = job.specs
  const meta = job.metadata

  const items: { ok: boolean; label: string }[] = [
    {
      ok: specs ? specs.width === 1080 && specs.height === 1920 : true,
      label: "Resolusi 1080×1920 (9:16) sesuai rekomendasi TikTok",
    },
    { ok: true, label: "H.264 High + AAC 128kbps 44.1kHz — codec universal" },
    {
      ok: specs ? specs.duration <= 180 : true,
      label: specs
        ? `Durasi ${Math.round(specs.duration)}s ${specs.duration <= 60 ? "— rentang ideal (< 60s)" : specs.duration <= 180 ? "— masih baik (< 3 menit)" : "— panjang, completion rate berisiko"}`
        : "Durasi optimal",
    },
    {
      ok: meta ? meta.title.length <= 90 && meta.title.length >= 20 : true,
      label: meta ? `Judul ${meta.title.length} karakter — hook + keyword di depan` : "Judul SEO",
    },
    {
      ok: meta ? meta.hashtags.length >= 3 && meta.hashtags.length <= 6 : true,
      label: meta
        ? `${meta.hashtags.length} hashtag relevan (broad + niche, tanpa #fyp generik)`
        : "Hashtag relevan",
    },
    {
      ok: meta
        ? meta.keywords.length > 0 &&
          meta.caption.toLowerCase().includes(meta.keywords[0]?.toLowerCase().split(" ")[0] ?? "")
        : true,
      label: "Keyword utama muncul di caption (dibaca NLP TikTok)",
    },
    {
      ok: meta ? meta.overlays.length >= 3 : true,
      label: "Saran teks overlay tersedia (sinyal OCR TikTok)",
    },
    { ok: true, label: "+faststart & timescale 15360 — upload lancar ala CapCut" },
  ]

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
      <p className="mb-2.5 text-xs font-semibold text-zinc-300">Checklist Siap Upload</p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.label} className="flex items-start gap-2 text-[11px] leading-relaxed">
            {item.ok ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
            )}
            <span className={cn(item.ok ? "text-zinc-400" : "text-amber-300")}>{item.label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 rounded-lg bg-[#FE2C55]/5 px-2.5 py-2 text-[10px] leading-relaxed text-zinc-500">
        Tips riset terakhir: sebutkan keyword utama secara <strong>lisan</strong> di 3 detik pertama video — TikTok
        membaca audio (ASR) untuk peringkat pencarian.
      </p>
    </div>
  )
}

"use client"

import * as React from "react"
import { AlertTriangle, Clock3, Gauge, MonitorPlay } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useStudio } from "@/lib/store"
import { cn } from "@/lib/utils"
import { formatDuration } from "@/lib/format"
import type { AspectMode } from "@/lib/types"
import { ASPECT_OPTIONS, QUALITY_PRESETS } from "@/lib/tiktok-specs"
import type { QualityMode } from "@/lib/types"

function ModePreview({ mode, active }: { mode: AspectMode; active: boolean }) {
  return (
    <div
      className={cn(
        "relative mx-auto h-16 w-9 overflow-hidden rounded-md border bg-zinc-950",
        active ? "border-[#FE2C55]/70" : "border-zinc-700"
      )}
      aria-hidden
    >
      {mode === "crop" && <div className="absolute inset-0 scale-[1.9] bg-gradient-to-br from-zinc-500 to-zinc-700" />}
      {mode === "fit" && (
        <>
          <div className="absolute inset-x-0 top-0 h-[30%] bg-black" />
          <div className="absolute inset-x-0 top-1/2 h-[40%] -translate-y-1/2 bg-gradient-to-r from-zinc-400 to-zinc-600" />
          <div className="absolute inset-x-0 bottom-0 h-[30%] bg-black" />
        </>
      )}
      {mode === "blur" && (
        <>
          <div className="absolute inset-0 scale-[1.7] bg-gradient-to-br from-zinc-600 to-zinc-800 blur-[4px]" />
          <div className="absolute inset-x-1 top-1/2 h-5 -translate-y-1/2 rounded-[2px] bg-gradient-to-r from-zinc-300 to-zinc-500" />
        </>
      )}
    </div>
  )
}

export function SettingsPanel({ disabled }: { disabled: boolean }) {
  const settings = useStudio((s) => s.settings)
  const setSettings = useStudio((s) => s.setSettings)
  const clips = useStudio((s) => s.clips)

  const totalDuration = clips.reduce((a, c) => a + c.duration, 0)
  const warnLong = totalDuration > 180
  const tooLong = totalDuration > 600

  return (
    <section
      aria-label="Pengaturan encode"
      className={cn(
        "rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-6",
        disabled && "pointer-events-none opacity-60"
      )}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2.5 text-sm font-semibold">
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-[#FE2C55]/15 text-[11px] font-bold text-[#FF6B85]">
            3
          </span>
          Pengaturan Encode TikTok
        </h2>
        <span className="text-[11px] text-zinc-500">Preset hasil riset TikTok / Douyin / CapCut</span>
      </div>

      <div className="space-y-5">
        {/* Mode penanganan aspek */}
        <fieldset>
          <legend className="mb-2 flex items-center gap-1.5 text-xs font-medium text-zinc-400">
            <MonitorPlay className="h-3.5 w-3.5" /> Mode konversi ke 9:16
          </legend>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {ASPECT_OPTIONS.map((opt) => {
              const active = settings.aspect === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSettings({ aspect: opt.value })}
                  className={cn(
                    "rounded-xl border px-1.5 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FE2C55]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B] active:scale-[0.98] sm:p-3",
                    active
                      ? "border-[#FE2C55]/60 bg-[#FE2C55]/10"
                      : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700"
                  )}
                >
                  <ModePreview mode={opt.value} active={active} />
                  <p className={cn("mt-2 text-[10px] font-semibold tracking-tight sm:text-xs", active ? "text-[#FF6B85]" : "text-zinc-300")}>
                    {opt.title}
                  </p>
                  <p className="mt-0.5 hidden text-[10px] leading-snug text-zinc-500 sm:block">{opt.desc}</p>
                </button>
              )
            })}
          </div>
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          {/* FPS */}
          <fieldset>
            <legend className="mb-2 flex items-center gap-1.5 text-xs font-medium text-zinc-400">
              <Gauge className="h-3.5 w-3.5" /> Frame rate
            </legend>
            <ToggleGroup
              type="single"
              variant="outline"
              value={String(settings.fps)}
              onValueChange={(v) => {
                if (v === "30" || v === "60") setSettings({ fps: v === "30" ? 30 : 60 })
              }}
              className="w-full"
            >
              <ToggleGroupItem value="30" className="flex-1 text-xs data-[state=on]:border-[#FE2C55]/50 data-[state=on]:bg-[#FE2C55]/10 data-[state=on]:text-[#FF6B85]">
                30 fps · standar
              </ToggleGroupItem>
              <ToggleGroupItem value="60" className="flex-1 text-xs data-[state=on]:border-[#FE2C55]/50 data-[state=on]:bg-[#FE2C55]/10 data-[state=on]:text-[#FF6B85]">
                60 fps · halus
              </ToggleGroupItem>
            </ToggleGroup>
          </fieldset>

          {/* Kualitas */}
          <fieldset>
            <legend className="mb-2 flex items-center gap-1.5 text-xs font-medium text-zinc-400">
              <Gauge className="h-3.5 w-3.5" /> Kualitas bitrate
            </legend>
            <div className="grid grid-cols-3 gap-1.5">
              {(Object.keys(QUALITY_PRESETS) as QualityMode[]).map((key) => {
                const q = QUALITY_PRESETS[key]
                const active = settings.quality === key
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSettings({ quality: key })}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FE2C55]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090B] active:scale-[0.98]",
                      active
                        ? "border-[#FE2C55]/60 bg-[#FE2C55]/10 text-[#FF6B85]"
                        : "border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700"
                    )}
                  >
                    <span className="block text-[11px] font-semibold sm:text-xs">{q.label}</span>
                    <span className="mt-0.5 block text-[9px] leading-tight text-zinc-500">{q.maxrate.replace("M", " Mbps")}</span>
                  </button>
                )
              })}
            </div>
          </fieldset>
        </div>

        {/* Ringkasan durasi */}
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs",
            tooLong
              ? "border-red-500/30 bg-red-500/10 text-red-300"
              : warnLong
                ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                : "border-zinc-800 bg-zinc-900/60 text-zinc-400"
          )}
        >
          <Clock3 className="h-3.5 w-3.5 shrink-0" />
          {clips.length === 0 ? (
            <span>Total durasi akan muncul setelah klip diunggah.</span>
          ) : (
            <span>
              <strong className="font-semibold">{clips.length} klip</strong> · total{" "}
              <strong className="font-semibold">{formatDuration(totalDuration)}</strong>
              {tooLong
                ? " — melebihi batas unggah TikTok (10 menit). Persingkat dulu."
                : warnLong
                  ? " — completion rate ideal di 15–60 detik. Pertimbangkan split."
                  : totalDuration <= 60
                    ? " — di rentang ideal untuk completion rate tinggi."
                    : ""}
            </span>
          )}
          {warnLong && !tooLong && <AlertTriangle className="ml-auto h-3.5 w-3.5 shrink-0" />}
          {tooLong && <AlertTriangle className="ml-auto h-3.5 w-3.5 shrink-0" />}
        </div>
      </div>
    </section>
  )
}

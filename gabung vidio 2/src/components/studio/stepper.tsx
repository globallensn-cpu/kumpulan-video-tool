"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

const STEPS = ["Unggah", "Susun", "Proses", "Hasil"]

export function Stepper({ current, className }: { current: number; className?: string }) {
  return (
    <nav aria-label="Langkah proses" className={cn("flex items-center gap-1", className)}>
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-1">
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
              i < current
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : i === current
                  ? "border-[#FE2C55]/50 bg-[#FE2C55]/10 text-[#FF6B85]"
                  : "border-zinc-800 bg-zinc-900/60 text-zinc-400"
            )}
          >
            <span
              className={cn(
                "grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold",
                i < current
                  ? "bg-emerald-500 text-black"
                  : i === current
                    ? "bg-[#FE2C55] text-white"
                    : "bg-zinc-800 text-zinc-400"
              )}
            >
              {i < current ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : i + 1}
            </span>
            <span className="hidden sm:inline">{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={cn("h-px w-3 sm:w-5", i < current ? "bg-emerald-500/40" : "bg-zinc-800")} />
          )}
        </div>
      ))}
    </nav>
  )
}

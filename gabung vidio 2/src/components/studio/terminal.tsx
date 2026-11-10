"use client"

import * as React from "react"
import type { LogEntry } from "@/lib/types"
import { cn } from "@/lib/utils"

const LEVEL_CLASS: Record<LogEntry["level"], string> = {
  info: "text-zinc-400",
  cmd: "text-[#25F4EE]",
  ok: "text-emerald-400",
  warn: "text-amber-400",
  err: "text-red-400",
}

function timeOf(t: number): string {
  const d = new Date(t)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(
    d.getSeconds()
  ).padStart(2, "0")}`
}

export const Terminal = React.memo(
  function Terminal({ logs, live }: { logs: LogEntry[]; live?: boolean }) {
    const ref = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
      ref.current?.scrollTo({ top: ref.current.scrollHeight })
    }, [logs])

    return (
      <div
        ref={ref}
        aria-live="polite"
        aria-label="Log proses pipeline"
        className="h-44 overflow-y-auto overscroll-contain rounded-xl border border-zinc-800 bg-black/70 p-3 font-mono text-[11px] leading-relaxed [scrollbar-gutter:stable]"
      >
        {logs.length === 0 && <div className="text-zinc-600">$ menunggu eksekusi…</div>}
        {logs.map((l, i) => (
          <div key={`${l.t}-${i}`} className={cn("break-all", LEVEL_CLASS[l.level])}>
            <span className="mr-2 select-none text-zinc-700">{timeOf(l.t)}</span>
            {l.msg}
          </div>
        ))}
        {live && (
          <div className="mt-0.5 flex items-center gap-1 text-zinc-500">
            <span className="text-zinc-700">$</span>
            <span className="inline-block h-3.5 w-1.5 animate-pulse bg-[#25F4EE]/80" />
          </div>
        )}
      </div>
    )
  },
  // Optimasi: polling tiap 1.2s menghasilkan array logs baru — skip re-render
  // bila tidak ada log baru (bandingkan panjang + referensi entri terakhir).
  (a, b) =>
    a.live === b.live &&
    a.logs.length === b.logs.length &&
    a.logs[a.logs.length - 1] === b.logs[b.logs.length - 1]
)

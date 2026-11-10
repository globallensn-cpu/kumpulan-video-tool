"use client"

// Error boundary rute (App Router) — menangkap error render tak terduga
// agar pengguna melihat pesan yang jelas, bukan layar putih.

import * as React from "react"
import { AlertTriangle, RotateCcw } from "lucide-react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    console.error("[TokForge] Render error:", error)
  }, [error])

  return (
    <div className="grid min-h-screen place-items-center bg-[#09090B] px-4 text-zinc-100">
      <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center shadow-2xl shadow-black/40">
        <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-red-500/15">
          <AlertTriangle className="h-6 w-6 text-red-400" />
        </span>
        <h1 className="text-base font-bold">Terjadi kesalahan tak terduga</h1>
        <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
          {error.message || "Sesuatu yang tidak terduga terjadi di studio TokForge."}
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-[10px] text-zinc-600">digest: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FE2C55] to-[#FF6B3D] px-4 text-xs font-bold text-white shadow-lg shadow-[#FE2C55]/25 transition-all hover:brightness-110"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Coba lagi
        </button>
      </div>
    </div>
  )
}

"use client"

// Global error boundary — jaring pengaman terakhir (fallback root layout).
// Wajib merender <html> dan <body> sendiri.

import { AlertTriangle, RotateCcw } from "lucide-react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="id">
      <body className="bg-[#09090B] font-sans">
        <div className="grid min-h-screen place-items-center px-4 text-zinc-100">
          <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center">
            <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-red-500/15">
              <AlertTriangle className="h-6 w-6 text-red-400" />
            </span>
            <h1 className="text-base font-bold">Aplikasi mengalami error kritis</h1>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
              {error.message || "Muat ulang halaman untuk kembali ke studio."}
            </p>
            <button
              onClick={reset}
              className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FE2C55] to-[#FF6B3D] px-4 text-xs font-bold text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Muat ulang
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}

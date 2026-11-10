"use client"

import * as React from "react"
import { AlertCircle, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * error.tsx — boundary level route. Menangkap error render di seluruh app
 * agar tidak blank page. Pengguna bisa muat ulang atau kembali.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    console.error("PotongVideo error:", error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center text-zinc-100">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15">
        <AlertCircle className="h-7 w-7 text-red-400" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-bold">Terjadi kesalahan tak terduga</h1>
        <p className="mx-auto max-w-md text-sm text-zinc-400">
          Maaf, halaman mengalami masalah. Coba muat ulang — file dan progres
          pemotonganmu yang masih berjalan tetap aman di server.
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          onClick={reset}
          className="h-11 rounded-xl bg-amber-500 px-5 font-semibold text-zinc-950 hover:bg-amber-400"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Coba Lagi
        </Button>
        <Button
          asChild
          variant="outline"
          className="h-11 rounded-xl border-zinc-700 bg-zinc-800 px-5 font-semibold text-zinc-200 hover:bg-zinc-700"
        >
          <a href="/">Kembali ke Beranda</a>
        </Button>
      </div>
      {error?.message && (
        <details className="mt-2 max-w-md text-left text-xs text-zinc-500">
          <summary className="cursor-pointer">Detail teknis</summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-zinc-900 p-3 text-zinc-400">
            {error.message}
            {error.digest ? `\n\ndigest: ${error.digest}` : ""}
          </pre>
        </details>
      )}
    </div>
  )
}

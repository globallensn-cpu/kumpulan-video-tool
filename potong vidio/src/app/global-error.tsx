"use client"

import * as React from "react"
import { AlertCircle, RefreshCw } from "lucide-react"

/**
 * global-error.tsx — boundary paling atas. Menggantikan <html><body>
 * saat root layout throw. Wajib mengandung <html><body> sendiri.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    console.error("PotongVideo global error:", error)
  }, [error])

  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          background: "#09090b",
          color: "#fafafa",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: "0 24px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "9999px",
              background: "rgba(239, 68, 68, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AlertCircle style={{ width: 28, height: 28, color: "#f87171" }} aria-hidden="true" />
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
            Aplikasi mengalami kesalahan kritis
          </h1>
          <p style={{ maxWidth: 440, fontSize: 14, color: "#a1a1aa", margin: 0 }}>
            Maaf, terjadi masalah pada level paling dasar. Coba muat ulang
            halaman. File dan progres pemotonganmu yang sedang berjalan tetap
            aman di server.
          </p>
          <button
            onClick={reset}
            style={{
              height: 44,
              padding: "0 20px",
              borderRadius: 12,
              background: "#f59e0b",
              color: "#09090b",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
            }}
          >
            <RefreshCw style={{ width: 16, height: 16 }} aria-hidden="true" />
            Coba Lagi
          </button>
        </div>
      </body>
    </html>
  )
}

import Link from "next/link"
import { AlertCircle, Home } from "lucide-react"

import { Button } from "@/components/ui/button"

export const runtime = "nodejs"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center text-zinc-100">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15">
        <AlertCircle className="h-7 w-7 text-amber-400" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold">404 — Halaman tidak ditemukan</h1>
        <p className="mx-auto max-w-md text-sm text-zinc-400">
          Maaf, alamat yang kamu buka tidak tersedia. Mungkin sudah kedaluwarsa
          atau salah ketik.
        </p>
      </div>
      <Button asChild className="h-11 rounded-xl bg-amber-500 px-5 font-semibold text-zinc-950 hover:bg-amber-400">
        <Link href="/">
          <Home className="h-4 w-4" aria-hidden="true" />
          Kembali ke Beranda
        </Link>
      </Button>
    </div>
  )
}

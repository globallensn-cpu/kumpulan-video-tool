import Link from "next/link"
import { Compass } from "lucide-react"

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#09090B] px-4 text-zinc-100">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-center shadow-2xl shadow-black/40">
        <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-[#FE2C55]/15">
          <Compass className="h-6 w-6 text-[#FF6B85]" />
        </span>
        <h1 className="text-base font-bold">404 — Halaman tidak ditemukan</h1>
        <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
          Alamat yang kamu buka tidak ada. Kembali ke studio untuk menggabung video jadi
          TikTok-ready.
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FE2C55] to-[#FF6B3D] px-4 text-xs font-bold text-white shadow-lg shadow-[#FE2C55]/25 transition-all hover:brightness-110"
        >
          Kembali ke Studio
        </Link>
      </div>
    </div>
  )
}

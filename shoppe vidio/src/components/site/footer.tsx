"use client";

import { TermsDialog } from "@/components/site/terms-dialog";
import { ShieldCheck } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t bg-muted/30 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          {/* Brand */}
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <img src="/logo.svg" alt="" className="size-7 rounded-lg" width={28} height={28} />
              <span className="text-base font-bold tracking-tight">
                Shop<span className="text-primary">Save</span>
              </span>
            </div>
            <p className="mt-2.5 text-sm text-muted-foreground leading-relaxed">
              Alat pengunduh video Shopee tanpa watermark — cepat, bersih, dan tanpa iklan.
            </p>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm" aria-label="Tautan footer">
            <a href="#tool" className="text-muted-foreground hover:text-primary transition-colors">Alat</a>
            <a href="#cara-pakai" className="text-muted-foreground hover:text-primary transition-colors">Cara Pakai</a>
            <a href="#faq" className="text-muted-foreground hover:text-primary transition-colors">FAQ</a>
            <a href="#kontak" className="text-muted-foreground hover:text-primary transition-colors">Kontak</a>
            <TermsDialog />
          </nav>
        </div>

        <div className="mt-8 pt-6 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} ShopSave. Tidak berafiliasi dengan Shopee.</p>
          <p className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-primary" />
            Tidak menyimpan video & tidak meminta data pribadi.
          </p>
        </div>
      </div>
    </footer>
  );
}

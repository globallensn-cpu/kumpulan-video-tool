"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

const STATS = [
  { value: "HD", label: "Kualitas Asli" },
  { value: "0%", label: "Watermark" },
  { value: "0", label: "Iklan" },
  { value: "Gratis", label: "Selamanya" },
];

export function Hero() {
  const [stats, setStats] = useState<{ successCount: number; downloadCount: number } | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok) setStats({ successCount: d.successCount, downloadCount: d.downloadCount });
      })
      .catch(() => undefined);
  }, []);

  return (
    <section className="brand-gradient">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-14 pb-10 sm:pt-20 sm:pb-14 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="space-y-6"
        >
          <Badge variant="outline" className="mx-auto gap-1.5 px-3.5 py-1.5 rounded-full border-primary/30 text-primary bg-primary/5 font-medium">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            Tanpa iklan · Tanpa aplikasi · Tanpa login
          </Badge>

          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            Unduh Video Shopee
            <span className="block text-primary">Tanpa Watermark</span>
          </h1>

          <p className="mx-auto max-w-2xl text-pretty text-base sm:text-lg text-muted-foreground leading-relaxed">
            Tempel tautan produk Shopee, klik unduh, dan simpan videonya dalam kualitas asli —
            sempurna untuk reseller, konten afiliasi, dan arsip pribadi.
          </p>
        </motion.div>
      </div>

      {/* Stats strip */}
      <div className="mx-auto max-w-4xl px-4 sm:px-6 pb-12">
        <div className="grid grid-cols-4 gap-2 sm:gap-4 rounded-2xl border bg-card/70 backdrop-blur p-4 sm:p-6 shadow-sm">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-2xl sm:text-3xl font-extrabold text-primary tracking-tight">{s.value}</p>
              <p className="mt-0.5 text-[11px] sm:text-sm text-muted-foreground font-medium">{s.label}</p>
            </div>
          ))}
          {stats && stats.successCount + stats.downloadCount > 0 && (
            <div className="col-span-4 pt-3 text-center text-xs text-muted-foreground border-t">
              {stats.successCount + stats.downloadCount} video diproses sejauh ini
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

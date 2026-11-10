"use client";

import { motion } from "framer-motion";
import { Share2, ClipboardPaste, Download } from "lucide-react";

const STEPS = [
  {
    icon: Share2,
    step: "1",
    title: "Salin tautan produk",
    body: "Buka aplikasi Shopee, cari produk yang memiliki video di halamannya. Ketuk ikon Bagikan (Share), lalu pilih Salin Link.",
  },
  {
    icon: ClipboardPaste,
    step: "2",
    title: "Tempel di ShopSave",
    body: "Kembali ke halaman ini dan tempel tautan pada kolom di atas. Atau gunakan tombol tempel otomatis dari clipboard.",
  },
  {
    icon: Download,
    step: "3",
    title: "Klik unduh & simpan",
    body: "Tunggu beberapa detik hingga pratinjau muncul, lalu klik Unduh Video (MP4). File tersimpan tanpa watermark siap dipakai.",
  },
];

export function Steps() {
  return (
    <section id="cara-pakai" className="scroll-mt-20 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Cara Mengunduh Video Shopee</h2>
          <p className="mt-3 text-muted-foreground">
            Tiga langkah sederhana — selesai dalam waktu kurang dari 30 detik, di HP maupun komputer.
          </p>
        </div>

        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <motion.li
              key={s.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: i * 0.12 }}
            >
              <div className="relative h-full rounded-2xl border bg-card p-6 shadow-sm hover:shadow-md hover:border-primary/30 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
                    <s.icon className="size-6 text-primary" aria-hidden />
                  </div>
                  <span className="text-4xl font-extrabold text-primary/15 select-none" aria-hidden>
                    {s.step}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}

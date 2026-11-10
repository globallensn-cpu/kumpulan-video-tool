"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Zap, BadgeDollarSign, Ban, MonitorSmartphone, Lock } from "lucide-react";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Tanpa Watermark",
    body: "Video diambil langsung dari sumber asli Shopee — bersih dari logo, teks, atau tanda air apa pun.",
  },
  {
    icon: Zap,
    title: "Kualitas Asli & HD",
    body: "Tidak ada kompresi ulang. File yang Anda unduh sama persis dengan video yang diputar di aplikasi.",
  },
  {
    icon: Ban,
    title: "Nol Iklan",
    body: "Tidak ada pop-up, redirect, atau banner mengganggu. Antarmuka bersih — fokus ke satu tugas: mengunduh.",
  },
  {
    icon: BadgeDollarSign,
    title: "Gratis Selamanya",
    body: "Tanpa akun, tanpa langganan, tanpa batas harian yang menguras kesabaran. Pakai seperlunya, kapan pun.",
  },
  {
    icon: MonitorSmartphone,
    title: "Semua Perangkat",
    body: "Berjalan mulus di browser HP Android, iPhone, dan desktop. Tidak perlu memasang aplikasi atau ekstensi.",
  },
  {
    icon: Lock,
    title: "Aman & Privat",
    body: "Tidak ada data pribadi yang diminta. Video diproses langsung dan riwayat unduhan tidak dibagikan ke pihak mana pun.",
  },
];

export function Features() {
  return (
    <section id="fitur" className="scroll-mt-20 bg-muted/40 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Kenapa ShopSave?</h2>
          <p className="mt-3 text-muted-foreground">
            Dibangun dari nol sebagai alternatif yang jauh lebih rapi dan jujur dibanding alat serupa
            yang penuh iklan.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: (i % 3) * 0.1 }}
              className="group rounded-2xl border bg-card p-6 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary group-hover:[&>svg]:text-primary-foreground transition-colors">
                <f.icon className="size-5.5 text-primary transition-colors" aria-hidden />
              </div>
              <h3 className="mt-4 font-semibold text-lg">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

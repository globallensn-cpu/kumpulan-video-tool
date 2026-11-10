"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS = [
  {
    q: "Apakah videonya benar-benar tanpa watermark?",
    a: "Ya. Video diambil langsung dari sumber aslinya di server Shopee, bukan hasil rekaman layar atau kompresi ulang. Jadi file yang Anda unduh bersih tanpa logo, nama toko, atau tanda air apa pun.",
  },
  {
    q: "Format apa yang saya dapatkan?",
    a: "Video dalam format MP4 (H.264) — kompatibel dengan semua pemutar: galeri HP Android, iPhone, VLC, Premiere, CapCut, dan lainnya. Anda juga bisa mengunduh thumbnail video dalam bentuk gambar.",
  },
  {
    q: "Apakah ada batas jumlah unduhan?",
    a: "Tidak ada batas yang mengganggu. Sistem hanya menerapkan pembatasan teknis wajar (beberapa puluh unduhan per menit per pengguna) untuk menjaga layanan tetap stabil dan cepat bagi semua orang.",
  },
  {
    q: "Kenapa tautan saya gagal diproses?",
    a: "Penyebab paling umum: (1) tautan bukan link produk Shopee, (2) produk tidak memiliki video sama sekali, (3) tautan sudah kedaluwarsa atau produk dihapus, atau (4) Shopee sedang membatasi server kami untuk sementara. Pastikan tautan disalin langsung dari aplikasi Shopee lewat tombol Bagikan → Salin Link.",
  },
  {
    q: "Apakah saya perlu login atau membuat akun?",
    a: "Tidak pernah. Kami tidak meminta email, nomor telepon, maupun akun Shopee Anda. Cukup tempel tautan dan unduh.",
  },
  {
    q: "Apakah aman digunakan untuk konten afiliasi atau reseller?",
    a: "Untuk kebutuhan pribadi, reseller, dan promosi produk melalui program afiliasi resmi Shopee — umum dilakukan. Namun Anda tetap bertanggung jawab menghormati hak cipta konten kreator dan ketentuan Shopee. Lihat halaman Ketentuan Layanan kami untuk detail.",
  },
  {
    q: "Apakah bisa dipakai untuk semua region Shopee?",
    a: "Ya, tautan dari Shopee Indonesia, Singapura, Malaysia, Thailand, Vietnam, Filipina, Taiwan, dan Brasil semuanya didukung. Deteksi region dilakukan otomatis dari tautan yang Anda tempel.",
  },
  {
    q: "Apakah videonya juga diunduh dari Shopee Live?",
    a: "Saat ini ShopSave berfokus pada video produk. Video live/replay Shopee Live menggunakan sistem streaming berbeda dan belum didukung.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 py-16 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Pertanyaan Umum</h2>
          <p className="mt-3 text-muted-foreground">Jawaban atas hal yang paling sering ditanyakan pengguna.</p>
        </div>

        <Accordion type="single" collapsible className="mt-10">
          {FAQS.map((f, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-left text-base font-medium hover:text-primary hover:no-underline">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

export function TermsDialog({ triggerLabel = "Ketentuan Layanan" }: { triggerLabel?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="link" className="h-auto p-0 text-muted-foreground hover:text-primary">
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Ketentuan Layanan</DialogTitle>
          <DialogDescription>
            Berlaku sejak 2 November 2026. Dengan menggunakan ShopSave, Anda menyetujui ketentuan berikut.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4 nice-scroll">
          <div className="space-y-5 text-sm leading-relaxed text-foreground/90 pb-4">
            <section>
              <h4 className="font-semibold text-foreground mb-1.5">1. Deskripsi Layanan</h4>
              <p>
                ShopSave adalah alat daring gratis yang membantu pengguna mengunduh video produk yang tersedia
                secara publik di platform Shopee. Layanan tidak berafiliasi dengan, didukung oleh, atau
                bermata dua dengan Shopee. Nama Shopee adalah merek dagang milik pihak masing-masing.
              </p>
            </section>
            <section>
              <h4 className="font-semibold text-foreground mb-1.5">2. Penggunaan yang Dapat Diterima</h4>
              <p>
                Anda boleh menggunakan layanan ini untuk kebutuhan pribadi, arsip, reseller, atau promosi produk
                melalui program afiliasi resmi. Anda <strong>tidak boleh</strong>: (a) mengunduh konten untuk
                diklaim sebagai milik sendiri, (b) menggunakan video untuk tujuan yang melanggar hukum,
                (c) menjual ulang video tanpa izin pemilik konten, atau (d) menyalahgunakan layanan dengan
                permintaan otomatis berlebihan (scraping/robot).
              </p>
            </section>
            <section>
              <h4 className="font-semibold text-foreground mb-1.5">3. Hak Cipta</h4>
              <p>
                Seluruh video dan gambar adalah milik kreator atau penjual masing-masing. ShopSave tidak
                menyimpan video pada server kami — file diambil langsung dari sumbernya dan diteruskan ke Anda.
                Tanggung jawab atas penggunaan konten sepenuhnya berada pada pengguna.
              </p>
            </section>
            <section>
              <h4 className="font-semibold text-foreground mb-1.5">4. Privasi</h4>
              <p>
                Kami tidak meminta akun, kata sandi, atau data pribadi untuk menggunakan alat utama. Pesan yang
                dikirim melalui formulir kontak hanya digunakan untuk membalas Anda dan tidak dibagikan ke
                pihak ketiga. Statistik agregat (jumlah unduhan) disimpan tanpa identitas pengguna.
              </p>
            </section>
            <section>
              <h4 className="font-semibold text-foreground mb-1.5">5. Batasan Tanggung Jawab</h4>
              <p>
                Layanan disediakan &ldquo;sebagaimana adanya&rdquo;. Karena ekstraksi bergantung pada pihak ketiga
                (Shopee), kami tidak menjamin ketersediaan layanan yang tanpa gangguan. ShopSave tidak
                bertanggung jawab atas kerugian tidak langsung akibat penggunaan layanan.
              </p>
            </section>
            <section>
              <h4 className="font-semibold text-foreground mb-1.5">6. Perubahan Ketentuan</h4>
              <p>
                Ketentuan ini dapat diperbarui sewaktu-waktu. Perubahan berlaku sejak dipublikasikan di halaman
                ini. Penggunaan layanan setelah pembaruan dianggap sebagai persetujuan.
              </p>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

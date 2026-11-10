"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, Mail } from "lucide-react";

export function Contact() {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message }),
      });
      const json = await res.json();
      if (json.ok) {
        toast({ title: "Pesan terkirim", description: json.message });
        setName("");
        setEmail("");
        setSubject("");
        setMessage("");
      } else {
        toast({ title: "Gagal mengirim", description: json.message, variant: "destructive" });
      }
    } catch {
      toast({
        title: "Gagal mengirim",
        description: "Tidak dapat terhubung ke server. Coba beberapa saat lagi.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <section id="kontak" className="scroll-mt-20 bg-muted/40 py-16 sm:py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Hubungi Kami</h2>
          <p className="mt-3 text-muted-foreground">
            Ada pertanyaan, laporan bug, atau saran fitur? Kirim pesan — kami membalas dalam 1×24 jam kerja.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-5">
          {/* Info side */}
          <Card className="lg:col-span-2 rounded-2xl">
            <CardContent className="p-6 flex flex-col h-full">
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10">
                <Mail className="size-5.5 text-primary" aria-hidden />
              </div>
              <h3 className="mt-4 font-semibold text-lg">Dukungan Cepat</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Tim kami membantu memastikan pengalaman unduh Anda selalu mulus. Sertakan tautan produk
                yang bermasalah agar kami bisa menelusuri lebih cepat.
              </p>
              <div className="mt-auto pt-6 space-y-3 text-sm">
                <div className="rounded-xl border bg-background px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Email</p>
                  <p className="font-medium">support@shopsave.example</p>
                </div>
                <div className="rounded-xl border bg-background px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Waktu Respons</p>
                  <p className="font-medium">Senin–Minggu, 08.00–22.00 WIB</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Form side */}
          <Card className="lg:col-span-3 rounded-2xl">
            <CardContent className="p-6">
              <form onSubmit={onSubmit} className="grid gap-4.5">
                <div className="grid gap-4.5 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="contact-name">Nama</Label>
                    <Input
                      id="contact-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nama Anda"
                      required
                      minLength={2}
                      maxLength={80}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="contact-email">Email</Label>
                    <Input
                      id="contact-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nama@email.com"
                      required
                      maxLength={120}
                      className="rounded-xl"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contact-subject">Subjek <span className="text-muted-foreground font-normal">(opsional)</span></Label>
                  <Input
                    id="contact-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Contoh: Tautan gagal diproses"
                    maxLength={140}
                    className="rounded-xl"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contact-message">Pesan</Label>
                  <Textarea
                    id="contact-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Ceritakan kendala atau pertanyaan Anda…"
                    required
                    minLength={10}
                    maxLength={4000}
                    rows={5}
                    className="rounded-xl resize-none"
                  />
                </div>
                <Button type="submit" disabled={sending} className="rounded-xl font-semibold w-fit px-8 shadow-lg shadow-primary/25">
                  {sending ? <Loader2 className="size-4.5 animate-spin" /> : <Send className="size-4.5" />}
                  {sending ? "Mengirim…" : "Kirim Pesan"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const contactSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(80),
  email: z.string().trim().email("Format email tidak valid.").max(120),
  subject: z.string().trim().max(140).optional().default(""),
  message: z.string().trim().min(10, "Pesan minimal 10 karakter.").max(4000),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Permintaan tidak valid." }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { ok: false, message: first?.message ?? "Data tidak valid." },
      { status: 422 }
    );
  }

  try {
    await db.contactMessage.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        subject: parsed.data.subject || null,
        message: parsed.data.message,
      },
    });
    return NextResponse.json({
      ok: true,
      message: "Pesan berhasil dikirim. Kami akan membalas ke email Anda dalam 1×24 jam kerja.",
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Gagal menyimpan pesan. Coba beberapa saat lagi." },
      { status: 500 }
    );
  }
}

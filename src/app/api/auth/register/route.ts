import { NextResponse, after } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, hashPassword } from "@/lib/auth";
import { slugify, uniqueSlug } from "@/lib/ids";
import { sendWelcomeEmail } from "@/lib/email";

const schema = z.object({
  name: z.string().min(3, "Informe seu nome completo."),
  email: z.string().email("E-mail inválido."),
  password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres."),
  phone: z.string().optional(),
  /** quando true, cria também o perfil de produtor */
  organizer: z.boolean().optional(),
  organizerName: z.string().optional(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }
  const { name, email, password, phone, organizer, organizerName } = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Já existe uma conta com este e-mail." },
      { status: 409 },
    );
  }

  const user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      phone: phone ?? null,
      passwordHash: await hashPassword(password),
      role: organizer ? "ORGANIZER" : "CUSTOMER",
    },
  });

  if (organizer) {
    const displayName = organizerName?.trim() || name;
    const slug = await uniqueSlug(slugify(displayName), async (s) =>
      Boolean(await prisma.organizer.findUnique({ where: { slug: s } })),
    );
    await prisma.organizer.create({
      data: { userId: user.id, displayName, slug },
    });
  }

  await createSession({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  after(() =>
    sendWelcomeEmail({ name: user.name, email: user.email }).catch((e) =>
      console.error("Falha ao enviar e-mail de boas-vindas", e),
    ),
  );

  return NextResponse.json({ ok: true, organizer: Boolean(organizer) });
}

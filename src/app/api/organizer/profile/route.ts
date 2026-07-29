import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { slugify, uniqueSlug } from "@/lib/ids";

const schema = z.object({
  displayName: z.string().min(2, "Informe o nome do produtor."),
  document: z.string().optional(),
  pixKey: z.string().optional(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (user.organizer) return NextResponse.json({ ok: true });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }

  const slug = await uniqueSlug(slugify(parsed.data.displayName), async (s) =>
    Boolean(await prisma.organizer.findUnique({ where: { slug: s } })),
  );

  await prisma.organizer.create({
    data: {
      userId: user.id,
      displayName: parsed.data.displayName,
      slug,
      document: parsed.data.document || null,
      pixKey: parsed.data.pixKey || null,
    },
  });
  await prisma.user.update({
    where: { id: user.id },
    data: { role: user.role === "ADMIN" ? "ADMIN" : "ORGANIZER" },
  });

  return NextResponse.json({ ok: true });
}

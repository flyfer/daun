import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrganizer } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  priceCents: z.number().int().min(0).optional(),
  quantity: z.number().int().min(0).optional(),
  maxPerOrder: z.number().int().min(1).max(20).optional(),
  active: z.boolean().optional(),
});

async function loadOwned(id: string) {
  const auth = await requireOrganizer();
  if (!auth.organizer) return { error: "unauthorized" as const };
  const tt = await prisma.ticketType.findFirst({
    where: { id, event: { organizerId: auth.organizer.id } },
  });
  if (!tt) return { error: "not_found" as const };
  return { ticketType: tt };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const owned = await loadOwned(id);
  if ("error" in owned) {
    return NextResponse.json(
      { error: owned.error },
      { status: owned.error === "unauthorized" ? 401 : 404 },
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const d = parsed.data;

  if (d.quantity !== undefined) {
    const min = owned.ticketType.sold + owned.ticketType.reserved;
    if (d.quantity < min) {
      return NextResponse.json(
        { error: `A quantidade não pode ser menor que ${min} (já vendidos/reservados).` },
        { status: 400 },
      );
    }
  }

  await prisma.ticketType.update({ where: { id }, data: d });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const owned = await loadOwned(id);
  if ("error" in owned) {
    return NextResponse.json(
      { error: owned.error },
      { status: owned.error === "unauthorized" ? 401 : 404 },
    );
  }
  if (owned.ticketType.sold > 0 || owned.ticketType.reserved > 0) {
    return NextResponse.json(
      { error: "Este lote já teve vendas — desative em vez de excluir." },
      { status: 400 },
    );
  }
  await prisma.ticketType.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

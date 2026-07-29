import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrganizer } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(1, "Dê um nome ao lote."),
  description: z.string().optional(),
  priceCents: z.number().int().min(0),
  quantity: z.number().int().min(1),
  maxPerOrder: z.number().int().min(1).max(20).optional(),
  salesEndAt: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireOrganizer();
  if (!auth.organizer) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const event = await prisma.event.findFirst({
    where: { id, organizerId: auth.organizer.id },
    include: { ticketTypes: true },
  });
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const created = await prisma.ticketType.create({
    data: {
      eventId: event.id,
      name: d.name,
      description: d.description || null,
      priceCents: d.priceCents,
      quantity: d.quantity,
      maxPerOrder: d.maxPerOrder ?? 6,
      position: event.ticketTypes.length,
      salesEndAt: d.salesEndAt ? new Date(d.salesEndAt) : null,
    },
  });

  return NextResponse.json({ id: created.id });
}

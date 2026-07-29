import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrganizer } from "@/lib/auth";
import { parseSaoPauloDatetime } from "@/lib/dates";

const schema = z.object({
  status: z.enum(["DRAFT", "PUBLISHED", "CANCELLED", "FINISHED"]).optional(),
  title: z.string().min(3).optional(),
  subtitle: z.string().optional(),
  description: z.string().min(10).optional(),
  category: z.string().min(1).optional(),
  coverUrl: z.string().url().optional().or(z.literal("")),
  venueName: z.string().min(2).optional(),
  address: z.string().min(3).optional(),
  city: z.string().min(2).optional(),
  state: z.string().length(2).optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  ageRating: z.string().optional(),
  maxPerOrder: z.number().int().min(1).max(20).optional(),
  serviceFeeBps: z.number().int().min(0).max(3000).optional(),
  feeMode: z.enum(["BUYER", "ORGANIZER"]).optional(),
});

export async function PATCH(
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

  if (d.status === "PUBLISHED") {
    const count = await prisma.ticketType.count({ where: { eventId: event.id } });
    if (count === 0) {
      return NextResponse.json(
        { error: "Cadastre ao menos um lote antes de publicar." },
        { status: 400 },
      );
    }
  }

  const startsAt = d.startsAt ? parseSaoPauloDatetime(d.startsAt) : undefined;
  if (startsAt && Number.isNaN(startsAt.getTime())) {
    return NextResponse.json({ error: "Data de início inválida." }, { status: 400 });
  }
  const endsAt =
    d.endsAt !== undefined ? (d.endsAt ? parseSaoPauloDatetime(d.endsAt) : null) : undefined;
  if (endsAt && endsAt < (startsAt ?? event.startsAt)) {
    return NextResponse.json(
      { error: "O término precisa ser depois do início." },
      { status: 400 },
    );
  }

  await prisma.event.update({
    where: { id: event.id },
    data: {
      ...(d.status ? { status: d.status } : {}),
      ...(d.title ? { title: d.title } : {}),
      ...(d.subtitle !== undefined ? { subtitle: d.subtitle || null } : {}),
      ...(d.description ? { description: d.description } : {}),
      ...(d.category ? { category: d.category } : {}),
      ...(d.coverUrl !== undefined ? { coverUrl: d.coverUrl || null } : {}),
      ...(d.venueName ? { venueName: d.venueName } : {}),
      ...(d.address ? { address: d.address } : {}),
      ...(d.city ? { city: d.city } : {}),
      ...(d.state ? { state: d.state.toUpperCase() } : {}),
      ...(startsAt ? { startsAt } : {}),
      ...(endsAt !== undefined ? { endsAt } : {}),
      ...(d.ageRating ? { ageRating: d.ageRating } : {}),
      ...(d.maxPerOrder ? { maxPerOrder: d.maxPerOrder } : {}),
      ...(d.serviceFeeBps !== undefined ? { serviceFeeBps: d.serviceFeeBps } : {}),
      ...(d.feeMode ? { feeMode: d.feeMode } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}

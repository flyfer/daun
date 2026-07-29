import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrganizer } from "@/lib/auth";
import { slugify, uniqueSlug } from "@/lib/ids";
import { parseSaoPauloDatetime } from "@/lib/dates";

const ticketTypeSchema = z.object({
  name: z.string().min(1, "Dê um nome ao lote."),
  description: z.string().optional(),
  priceCents: z.number().int().min(0),
  quantity: z.number().int().min(1, "O lote precisa ter ao menos 1 ingresso."),
  maxPerOrder: z.number().int().min(1).max(20).optional(),
});

const schema = z.object({
  title: z.string().min(3, "Informe o nome do evento."),
  subtitle: z.string().optional(),
  description: z.string().min(10, "Descreva o evento com pelo menos 10 caracteres."),
  category: z.string().min(1),
  coverUrl: z.string().url().optional().or(z.literal("")),
  venueName: z.string().min(2, "Informe o local."),
  address: z.string().min(3, "Informe o endereço."),
  city: z.string().min(2, "Informe a cidade."),
  state: z.string().length(2, "UF com 2 letras."),
  startsAt: z.string().min(1, "Informe a data de início."),
  endsAt: z.string().optional(),
  ageRating: z.string().optional(),
  maxPerOrder: z.number().int().min(1).max(20).optional(),
  serviceFeeBps: z.number().int().min(0).max(3000).optional(),
  feeMode: z.enum(["BUYER", "ORGANIZER"]).optional(),
  publish: z.boolean().optional(),
  ticketTypes: z.array(ticketTypeSchema).min(1, "Cadastre ao menos um lote."),
});

export async function POST(req: Request) {
  const auth = await requireOrganizer();
  if (auth.error === "unauthenticated") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (auth.error === "not_organizer" || !auth.organizer) {
    return NextResponse.json({ error: "Ative seu perfil de produtor." }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const startsAt = parseSaoPauloDatetime(data.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    return NextResponse.json({ error: "Data de início inválida." }, { status: 400 });
  }
  const endsAt = data.endsAt ? parseSaoPauloDatetime(data.endsAt) : null;
  if (endsAt && endsAt < startsAt) {
    return NextResponse.json(
      { error: "O término precisa ser depois do início." },
      { status: 400 },
    );
  }

  const slug = await uniqueSlug(slugify(data.title), async (s) =>
    Boolean(await prisma.event.findUnique({ where: { slug: s } })),
  );

  const event = await prisma.event.create({
    data: {
      slug,
      title: data.title,
      subtitle: data.subtitle || null,
      description: data.description,
      category: data.category,
      coverUrl: data.coverUrl || null,
      venueName: data.venueName,
      address: data.address,
      city: data.city,
      state: data.state.toUpperCase(),
      startsAt,
      endsAt,
      ageRating: data.ageRating || "Livre",
      maxPerOrder: data.maxPerOrder ?? 6,
      serviceFeeBps:
        data.serviceFeeBps ?? Number(process.env.DEFAULT_SERVICE_FEE_BPS ?? 1000),
      feeMode: data.feeMode ?? "BUYER",
      status: data.publish ? "PUBLISHED" : "DRAFT",
      organizerId: auth.organizer.id,
      ticketTypes: {
        create: data.ticketTypes.map((t, i) => ({
          name: t.name,
          description: t.description || null,
          priceCents: t.priceCents,
          quantity: t.quantity,
          maxPerOrder: t.maxPerOrder ?? 6,
          position: i,
        })),
      },
    },
  });

  return NextResponse.json({ id: event.id, slug: event.slug });
}

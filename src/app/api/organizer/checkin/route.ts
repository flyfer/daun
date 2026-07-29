import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrganizer } from "@/lib/auth";

const schema = z.object({
  code: z.string().min(4),
  eventId: z.string().min(1),
});

/** Valida um ingresso na portaria. Um código só pode ser usado uma vez. */
export async function POST(req: Request) {
  const auth = await requireOrganizer();
  if (!auth.organizer) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Código inválido." }, { status: 400 });
  }

  const code = parsed.data.code.trim().toUpperCase();

  const ticket = await prisma.ticket.findUnique({
    where: { code },
    include: { event: true, ticketType: true },
  });

  if (!ticket || ticket.event.organizerId !== auth.organizer.id) {
    return NextResponse.json({
      result: "INVALID",
      message: "Ingresso não encontrado.",
    });
  }
  if (ticket.eventId !== parsed.data.eventId) {
    return NextResponse.json({
      result: "WRONG_EVENT",
      message: `Este ingresso é de outro evento: ${ticket.event.title}.`,
    });
  }
  if (ticket.status === "CANCELLED") {
    return NextResponse.json({
      result: "CANCELLED",
      message: "Ingresso cancelado ou reembolsado.",
    });
  }
  if (ticket.status === "USED") {
    return NextResponse.json({
      result: "ALREADY_USED",
      message: `Já utilizado em ${ticket.checkedInAt?.toLocaleString("pt-BR")}.`,
      attendee: ticket.attendeeName,
      ticketType: ticket.ticketType.name,
    });
  }

  const updated = await prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      status: "USED",
      checkedInAt: new Date(),
      checkedInBy: auth.organizer.displayName,
    },
  });

  return NextResponse.json({
    result: "OK",
    message: "Entrada liberada!",
    attendee: updated.attendeeName,
    ticketType: ticket.ticketType.name,
  });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrganizer } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";

function csvCell(value: string) {
  if (/[;"\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvRow(values: string[]) {
  return values.map(csvCell).join(";");
}

export async function GET(
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

  const tickets = await prisma.ticket.findMany({
    where: { eventId: event.id, status: { not: "CANCELLED" } },
    include: { ticketType: true, order: true },
    orderBy: { createdAt: "asc" },
  });

  const statusLabel: Record<string, string> = {
    VALID: "Válido",
    USED: "Check-in feito",
    CANCELLED: "Cancelado",
  };

  const header = csvRow([
    "Convidado",
    "Email",
    "Telefone",
    "Tipo de ingresso",
    "Código do ingresso",
    "Status",
    "Check-in em",
    "Pedido",
    "Comprador",
  ]);

  const rows = tickets.map((t) =>
    csvRow([
      t.attendeeName,
      t.attendeeEmail,
      t.order.buyerPhone ?? "",
      t.ticketType.name,
      t.code,
      statusLabel[t.status] ?? t.status,
      t.checkedInAt ? formatDateTime(t.checkedInAt) : "",
      t.order.code,
      t.order.buyerName,
    ]),
  );

  const csv = "﻿" + [header, ...rows].join("\r\n") + "\r\n";
  const filename = `convidados-${event.slug}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

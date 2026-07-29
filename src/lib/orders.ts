import { prisma } from "./prisma";
import { newOrderCode, newTicketCode } from "./ids";
import { calcFeeCents } from "./money";
import { sendOrderConfirmationEmail } from "./email";

export type CartLine = { ticketTypeId: string; quantity: number };

export type BuyerInfo = {
  name: string;
  email: string;
  document?: string;
  phone?: string;
};

export class CheckoutError extends Error {}

const EXPIRATION_MINUTES = Number(process.env.ORDER_EXPIRATION_MINUTES ?? 30);

/**
 * Cria o pedido reservando estoque de forma atômica.
 * O estoque só vira "sold" quando o pagamento é confirmado; até lá fica em "reserved",
 * e volta a ficar disponível se o pedido expirar.
 */
export async function createOrder(params: {
  eventId: string;
  lines: CartLine[];
  buyer: BuyerInfo;
  paymentMethod: "PIX" | "CARD";
  userId?: string | null;
}) {
  const lines = params.lines.filter((l) => l.quantity > 0);
  if (lines.length === 0) throw new CheckoutError("Selecione ao menos um ingresso.");

  return prisma.$transaction(async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: params.eventId },
      include: { ticketTypes: true },
    });
    if (!event) throw new CheckoutError("Evento não encontrado.");
    if (event.status !== "PUBLISHED") {
      throw new CheckoutError("Este evento não está com vendas abertas.");
    }

    const totalQty = lines.reduce((s, l) => s + l.quantity, 0);
    if (totalQty > event.maxPerOrder) {
      throw new CheckoutError(
        `Máximo de ${event.maxPerOrder} ingressos por pedido neste evento.`,
      );
    }

    let subtotal = 0;
    let feeTotal = 0;
    const items: {
      ticketTypeId: string;
      quantity: number;
      unitPriceCents: number;
      unitFeeCents: number;
    }[] = [];

    const now = new Date();

    for (const line of lines) {
      const tt = event.ticketTypes.find((t) => t.id === line.ticketTypeId);
      if (!tt) throw new CheckoutError("Tipo de ingresso inválido.");
      if (!tt.active) throw new CheckoutError(`O lote "${tt.name}" não está disponível.`);
      if (tt.salesStartAt && tt.salesStartAt > now) {
        throw new CheckoutError(`As vendas do lote "${tt.name}" ainda não começaram.`);
      }
      if (tt.salesEndAt && tt.salesEndAt < now) {
        throw new CheckoutError(`As vendas do lote "${tt.name}" já encerraram.`);
      }
      if (line.quantity > tt.maxPerOrder) {
        throw new CheckoutError(
          `Máximo de ${tt.maxPerOrder} unidades do lote "${tt.name}" por pedido.`,
        );
      }

      const available = tt.quantity - tt.sold - tt.reserved;
      if (line.quantity > available) {
        throw new CheckoutError(
          available > 0
            ? `Restam apenas ${available} ingresso(s) do lote "${tt.name}".`
            : `O lote "${tt.name}" está esgotado.`,
        );
      }

      const unitFee = calcFeeCents(tt.priceCents, event.serviceFeeBps, event.feeMode);
      subtotal += tt.priceCents * line.quantity;
      feeTotal += unitFee * line.quantity;

      items.push({
        ticketTypeId: tt.id,
        quantity: line.quantity,
        unitPriceCents: tt.priceCents,
        unitFeeCents: unitFee,
      });

      // Reserva o estoque com guarda de concorrência
      const updated = await tx.ticketType.updateMany({
        where: { id: tt.id, reserved: tt.reserved, sold: tt.sold },
        data: { reserved: tt.reserved + line.quantity },
      });
      if (updated.count === 0) {
        throw new CheckoutError(
          `O lote "${tt.name}" acabou de ser atualizado. Tente novamente.`,
        );
      }
    }

    const order = await tx.order.create({
      data: {
        code: newOrderCode(),
        eventId: event.id,
        userId: params.userId ?? null,
        buyerName: params.buyer.name,
        buyerEmail: params.buyer.email.toLowerCase(),
        buyerDocument: params.buyer.document ?? null,
        buyerPhone: params.buyer.phone ?? null,
        subtotalCents: subtotal,
        feeCents: feeTotal,
        totalCents: subtotal + feeTotal,
        status: "PENDING",
        paymentMethod: params.paymentMethod,
        expiresAt: new Date(Date.now() + EXPIRATION_MINUTES * 60_000),
        items: { create: items },
      },
      include: { items: true, event: true },
    });

    return order;
  });
}

/**
 * Confirma o pagamento: converte reserva em venda e emite os ingressos.
 * Idempotente — chamar duas vezes não duplica ingressos.
 */
export async function confirmOrderPayment(orderId: string) {
  const { order: updated, justPaid } = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { ticketType: true } } },
    });
    if (!order) return { order: null, justPaid: false };
    if (order.status === "PAID") return { order, justPaid: false }; // idempotência

    for (const item of order.items) {
      await tx.ticketType.update({
        where: { id: item.ticketTypeId },
        data: {
          reserved: { decrement: item.quantity },
          sold: { increment: item.quantity },
        },
      });

      for (let i = 0; i < item.quantity; i++) {
        await tx.ticket.create({
          data: {
            code: newTicketCode(),
            orderId: order.id,
            eventId: order.eventId,
            ticketTypeId: item.ticketTypeId,
            attendeeName: order.buyerName,
            attendeeEmail: order.buyerEmail,
          },
        });
      }
    }

    const paid = await tx.order.update({
      where: { id: order.id },
      data: { status: "PAID", paidAt: new Date() },
    });
    return { order: paid, justPaid: true };
  });

  if (justPaid && updated) {
    sendOrderConfirmationEmail(updated.id).catch((e) =>
      console.error("Falha ao enviar e-mail de confirmação de compra", e),
    );
  }

  return updated;
}

/** Cancela um pedido pendente e devolve o estoque reservado. */
export async function releaseOrder(orderId: string, status: "EXPIRED" | "CANCELLED") {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order || order.status !== "PENDING") return null;

    for (const item of order.items) {
      await tx.ticketType.update({
        where: { id: item.ticketTypeId },
        data: { reserved: { decrement: item.quantity } },
      });
    }

    return tx.order.update({ where: { id: order.id }, data: { status } });
  });
}

/** Varre pedidos vencidos e devolve o estoque. Chamado no carregamento de páginas de venda. */
export async function expireStaleOrders() {
  const stale = await prisma.order.findMany({
    where: { status: "PENDING", expiresAt: { lt: new Date() } },
    select: { id: true },
    take: 50,
  });
  for (const o of stale) await releaseOrder(o.id, "EXPIRED");
  return stale.length;
}

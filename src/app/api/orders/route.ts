import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { CheckoutError, confirmOrderPayment, createOrder, releaseOrder } from "@/lib/orders";
import { getPaymentProvider } from "@/lib/payments";

const schema = z.object({
  eventId: z.string().min(1),
  paymentMethod: z.enum(["PIX", "CARD"]),
  buyer: z.object({
    name: z.string().min(3, "Informe seu nome completo."),
    email: z.string().email("E-mail inválido."),
    document: z.string().optional(),
    phone: z.string().optional(),
  }),
  lines: z
    .array(z.object({ ticketTypeId: z.string(), quantity: z.number().int().min(0) }))
    .min(1),
  card: z
    .object({
      number: z.string().optional(),
      holder: z.string().optional(),
      expMonth: z.number().optional(),
      expYear: z.number().optional(),
      cvv: z.string().optional(),
      installments: z.number().optional(),
      token: z.string().optional(),
      paymentMethodId: z.string().optional(),
      issuerId: z.string().optional(),
    })
    .optional(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }
  const input = parsed.data;
  const session = await getSession();

  let order;
  try {
    order = await createOrder({
      eventId: input.eventId,
      lines: input.lines,
      buyer: input.buyer,
      paymentMethod: input.paymentMethod,
      userId: session?.sub ?? null,
    });
  } catch (e) {
    const message =
      e instanceof CheckoutError ? e.message : "Não foi possível criar o pedido.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Evento gratuito: confirma na hora, sem passar pelo gateway.
  if (order.totalCents === 0) {
    await confirmOrderPayment(order.id);
    return NextResponse.json({ code: order.code, status: "PAID" });
  }

  try {
    const provider = getPaymentProvider();
    const charge = await provider.createCharge({
      orderId: order.id,
      orderCode: order.code,
      amountCents: order.totalCents,
      method: input.paymentMethod,
      description: `${order.event.title} — pedido ${order.code}`,
      payer: {
        name: order.buyerName,
        email: order.buyerEmail,
        document: order.buyerDocument,
        phone: order.buyerPhone,
      },
      expiresAt: order.expiresAt ?? new Date(Date.now() + 30 * 60_000),
      card: input.card as never,
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        provider: charge.provider,
        providerRef: charge.providerRef,
        pixQrCode: charge.pixQrCode ?? null,
        pixQrCodeImage: charge.pixQrCodeImage ?? null,
        cardBrand: charge.cardBrand ?? null,
        cardLast4: charge.cardLast4 ?? null,
      },
    });

    if (charge.status === "REJECTED") {
      await releaseOrder(order.id, "CANCELLED");
      return NextResponse.json(
        { error: charge.message ?? "Pagamento recusado. Tente outro cartão." },
        { status: 402 },
      );
    }

    if (charge.status === "PAID") {
      await confirmOrderPayment(order.id);
    }

    return NextResponse.json({ code: order.code, status: charge.status });
  } catch (e) {
    await releaseOrder(order.id, "CANCELLED");
    const message =
      e instanceof Error ? e.message : "Falha ao processar o pagamento.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

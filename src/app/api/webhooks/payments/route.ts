import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { confirmOrderPayment, releaseOrder } from "@/lib/orders";
import { getPaymentProvider } from "@/lib/payments";

/**
 * Endpoint de notificação do gateway.
 * Cadastre esta URL no painel do provedor: {APP_URL}/api/webhooks/payments
 * Sempre responde 200 para o gateway não reenviar indefinidamente —
 * as falhas ficam registradas em WebhookLog.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    body = Object.fromEntries(new URL(req.url).searchParams);
  }

  const provider = getPaymentProvider();
  const log = await prisma.webhookLog.create({
    data: { provider: provider.name, payload: raw.slice(0, 8000) },
  });

  try {
    const result = await provider.parseWebhook(body, req.headers);
    if (!result) return NextResponse.json({ ignored: true });

    const order = await prisma.order.findFirst({
      where: { providerRef: result.providerRef },
    });
    if (!order) return NextResponse.json({ ignored: true, reason: "order_not_found" });

    if (result.status === "PAID") {
      await confirmOrderPayment(order.id);
    } else if (result.status === "CANCELLED" && order.status === "PENDING") {
      await releaseOrder(order.id, "CANCELLED");
    } else if (result.status === "REFUNDED") {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "REFUNDED" },
      });
      await prisma.ticket.updateMany({
        where: { orderId: order.id, status: "VALID" },
        data: { status: "CANCELLED" },
      });
    }

    await prisma.webhookLog.update({
      where: { id: log.id },
      data: {
        processed: true,
        externalId: result.externalId ?? result.providerRef,
        eventType: result.eventType,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("webhook error", e);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

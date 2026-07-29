import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { confirmOrderPayment, releaseOrder } from "@/lib/orders";
import { getPaymentProvider } from "@/lib/payments";

/**
 * Consultado pela tela do pedido enquanto o Pix não é pago.
 * Além de devolver o status, faz reconciliação com o gateway —
 * assim o fluxo funciona mesmo se o webhook falhar ou atrasar.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const order = await prisma.order.findUnique({ where: { code } });
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (order.status === "PENDING") {
    if (order.expiresAt && order.expiresAt < new Date()) {
      await releaseOrder(order.id, "EXPIRED");
      return NextResponse.json({ status: "EXPIRED" });
    }
    if (order.providerRef) {
      try {
        const status = await getPaymentProvider().fetchStatus(order.providerRef);
        if (status === "PAID") {
          await confirmOrderPayment(order.id);
          return NextResponse.json({ status: "PAID" });
        }
      } catch {
        // gateway indisponível: mantém PENDING e tenta de novo no próximo poll
      }
    }
  }

  return NextResponse.json({ status: order.status });
}

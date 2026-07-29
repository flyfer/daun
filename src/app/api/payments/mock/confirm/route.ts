import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { confirmOrderPayment } from "@/lib/orders";
import { isMockProvider } from "@/lib/payments";

/**
 * Simulador de pagamento — só existe quando PAYMENT_PROVIDER=mock.
 * É o que o botão "Simular pagamento do Pix" chama na tela do pedido.
 */
export async function POST(req: Request) {
  if (!isMockProvider()) {
    return NextResponse.json({ error: "disabled" }, { status: 403 });
  }

  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  if (!code) return NextResponse.json({ error: "code obrigatório" }, { status: 400 });

  const order = await prisma.order.findUnique({ where: { code } });
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (order.status !== "PENDING") {
    return NextResponse.json({ status: order.status });
  }

  await confirmOrderPayment(order.id);
  return NextResponse.json({ status: "PAID" });
}

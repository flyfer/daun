import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { isMockProvider } from "@/lib/payments";
import { OrderStatusWatcher } from "@/components/order-status-watcher";
import { PixBox } from "@/components/pix-box";

export const dynamic = "force-dynamic";

export const metadata = { title: "Seu pedido" };

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  PENDING: { text: "Aguardando pagamento", className: "bg-amber-500/20 text-amber-300" },
  PAID: { text: "Pagamento confirmado", className: "bg-emerald-500/20 text-emerald-300" },
  EXPIRED: { text: "Pedido expirado", className: "bg-white/10 text-white/50" },
  CANCELLED: { text: "Pedido cancelado", className: "bg-red-500/20 text-red-300" },
  REFUNDED: { text: "Reembolsado", className: "bg-sky-500/20 text-sky-300" },
};

export default async function OrderPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const order = await prisma.order.findUnique({
    where: { code },
    include: {
      event: true,
      items: { include: { ticketType: true } },
      ticket: { include: { ticketType: true } },
    },
  });

  if (!order) notFound();

  const status = STATUS_LABEL[order.status] ?? STATUS_LABEL.PENDING;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <OrderStatusWatcher code={order.code} status={order.status} />

      <div className="card space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/40">
              Pedido {order.code}
            </p>
            <h1 className="text-2xl font-bold">{order.event.title}</h1>
            <p className="text-sm text-white/50">
              {formatDateTime(order.event.startsAt)} · {order.event.venueName},{" "}
              {order.event.city}/{order.event.state}
            </p>
          </div>
          <span className={`badge shrink-0 ${status.className}`}>{status.text}</span>
        </div>

        <div className="space-y-1.5 rounded-xl bg-ink-800 p-4 text-sm">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between text-white/70">
              <span>
                {item.quantity}× {item.ticketType.name}
              </span>
              <span>{formatBRL(item.unitPriceCents * item.quantity)}</span>
            </div>
          ))}
          {order.feeCents > 0 && (
            <div className="flex justify-between text-white/50">
              <span>Taxa de serviço</span>
              <span>{formatBRL(order.feeCents)}</span>
            </div>
          )}
          <div className="my-2 border-t border-white/10" />
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span>{formatBRL(order.totalCents)}</span>
          </div>
        </div>
      </div>

      {order.status === "PENDING" && order.paymentMethod === "PIX" && (
        <PixBox
          code={order.code}
          qrCodeImage={order.pixQrCodeImage}
          payload={order.pixQrCode}
          expiresAt={order.expiresAt?.toISOString() ?? null}
          allowSimulation={isMockProvider()}
        />
      )}

      {order.status === "PENDING" && order.paymentMethod === "CARD" && (
        <div className="card text-center text-white/60">
          Processando o pagamento no cartão... esta página atualiza sozinha.
        </div>
      )}

      {order.status === "PAID" && (
        <div className="card space-y-4">
          <div>
            <h2 className="text-lg font-bold">
              Seus ingressos ({order.ticket.length})
            </h2>
            <p className="text-sm text-white/50">
              Enviamos uma cópia para {order.buyerEmail}. Apresente o QR Code na entrada.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={`/ingresso/${order.ticket[0]?.code ?? ""}`} className="btn-primary">
              Ver ingressos
            </Link>
            <Link href="/meus-ingressos" className="btn-ghost">
              Meus ingressos
            </Link>
          </div>
        </div>
      )}

      {(order.status === "EXPIRED" || order.status === "CANCELLED") && (
        <div className="card space-y-3 text-center">
          <p className="text-white/60">
            {order.status === "EXPIRED"
              ? "O prazo para pagamento acabou e os ingressos voltaram para o estoque."
              : "Este pedido foi cancelado."}
          </p>
          <Link href={`/e/${order.event.slug}`} className="btn-primary">
            Tentar novamente
          </Link>
        </div>
      )}
    </div>
  );
}

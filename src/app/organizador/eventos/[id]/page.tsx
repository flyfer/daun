import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { formatBRL, calcOrganizerNetCents, bpsToPercent } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { StatusBadge } from "@/components/status-badge";
import { EventActions } from "@/components/event-actions";
import { TicketTypeManager } from "@/components/ticket-type-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gerenciar evento" };

export default async function ManageEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  if (!user.organizer) redirect("/organizador");

  const event = await prisma.event.findFirst({
    where: { id, organizerId: user.organizer.id },
    include: { ticketTypes: { orderBy: { position: "asc" } } },
  });
  if (!event) notFound();

  const orders = await prisma.order.findMany({
    where: { eventId: event.id, status: "PAID" },
    include: { items: true },
    orderBy: { paidAt: "desc" },
  });

  const gross = orders.reduce((s, o) => s + o.subtotalCents, 0);
  const fees = orders.reduce((s, o) => s + o.feeCents, 0);
  const net = orders.reduce(
    (s, o) =>
      s +
      o.items.reduce(
        (si, i) =>
          si +
          calcOrganizerNetCents(i.unitPriceCents, event.serviceFeeBps, event.feeMode) *
            i.quantity,
        0,
      ),
    0,
  );

  const [sold, checkedIn, pendingOrders] = await Promise.all([
    prisma.ticket.count({ where: { eventId: event.id, status: { not: "CANCELLED" } } }),
    prisma.ticket.count({ where: { eventId: event.id, status: "USED" } }),
    prisma.order.count({ where: { eventId: event.id, status: "PENDING" } }),
  ]);

  const capacity = event.ticketTypes.reduce((s, t) => s + t.quantity, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/organizador" className="text-sm text-white/40 hover:text-white">
            ← Painel
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <StatusBadge status={event.status} />
            <span className="text-xs text-white/40">
              {formatDateTime(event.startsAt)}
            </span>
          </div>
          <h1 className="text-3xl font-bold">{event.title}</h1>
          <p className="text-sm text-white/50">
            {event.venueName} · {event.city}/{event.state}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href={`/organizador/eventos/${event.id}/editar`} className="btn-ghost">
            Editar
          </Link>
          <Link href={`/e/${event.slug}`} className="btn-ghost">
            Ver página pública
          </Link>
          <Link href={`/organizador/eventos/${event.id}/checkin`} className="btn-primary">
            Check-in
          </Link>
        </div>
      </div>

      <EventActions eventId={event.id} status={event.status} slug={event.slug} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Ingressos vendidos" value={`${sold}${capacity ? ` / ${capacity}` : ""}`} />
        <Metric label="Check-in realizado" value={`${checkedIn}`} />
        <Metric label="Vendas brutas" value={formatBRL(gross)} />
        <Metric label="Você recebe" value={formatBRL(net)} highlight />
      </div>

      {pendingOrders > 0 && (
        <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-300/80">
          {pendingOrders} pedido(s) aguardando pagamento — o estoque fica reservado até o
          vencimento.
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Lotes</h2>
        <TicketTypeManager
          eventId={event.id}
          feeMode={event.feeMode}
          serviceFeeBps={event.serviceFeeBps}
          ticketTypes={event.ticketTypes.map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            priceCents: t.priceCents,
            quantity: t.quantity,
            sold: t.sold,
            reserved: t.reserved,
            active: t.active,
          }))}
        />
        <p className="text-xs text-white/40">
          Taxa de serviço deste evento: {bpsToPercent(event.serviceFeeBps)}% ·{" "}
          {event.feeMode === "BUYER"
            ? "paga pelo comprador"
            : "absorvida pelo produtor"}{" "}
          · total arrecadado em taxas: {formatBRL(fees)}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Últimas vendas</h2>
        {orders.length === 0 ? (
          <div className="card text-center text-white/50">Nenhuma venda ainda.</div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-ink-800 text-xs uppercase tracking-wide text-white/40">
                <tr>
                  <th className="px-4 py-3">Pedido</th>
                  <th className="px-4 py-3">Comprador</th>
                  <th className="px-4 py-3">Qtd</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Pago em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {orders.slice(0, 50).map((o) => (
                  <tr key={o.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 font-mono text-xs">{o.code}</td>
                    <td className="px-4 py-3">
                      <p>{o.buyerName}</p>
                      <p className="text-xs text-white/40">{o.buyerEmail}</p>
                    </td>
                    <td className="px-4 py-3">
                      {o.items.reduce((s, i) => s + i.quantity, 0)}
                    </td>
                    <td className="px-4 py-3">{formatBRL(o.totalCents)}</td>
                    <td className="px-4 py-3 text-white/50">
                      {o.paidAt ? formatDateTime(o.paidAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        highlight
          ? "border-brand-500/40 bg-linear-to-br from-brand-600/20 to-accent-500/10"
          : "border-white/10 bg-ink-900"
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-white/40">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

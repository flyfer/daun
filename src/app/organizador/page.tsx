import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { formatBRL, calcOrganizerNetCents } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { CreateOrganizerForm } from "@/components/create-organizer-form";
import { StatusBadge } from "@/components/status-badge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Painel do produtor" };

const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME || "TicketDaun";

export default async function OrganizerPage() {
  const user = await getCurrentUser();

  // Visitante: página de venda para produtores
  if (!user) {
    return (
      <div className="mx-auto max-w-2xl space-y-8 text-center">
        <div className="space-y-4">
          <h1 className="text-4xl font-black">
            Venda seus ingressos no <span className="gradient-text">{BRAND}</span>
          </h1>
          <p className="text-white/60">
            Crie o evento em minutos, receba por Pix e cartão, controle a portaria pelo
            celular. Sem mensalidade — você só paga a taxa sobre o que vender.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["Publique grátis", "Sem custo para criar e publicar o evento."],
            ["Receba rápido", "Repasse em D+2 após a realização do evento."],
            ["Controle total", "Vendas, lotes, cortesias e check-in em tempo real."],
          ].map(([t, d]) => (
            <div key={t} className="card text-left">
              <p className="font-bold">{t}</p>
              <p className="text-sm text-white/50">{d}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-3">
          <Link href="/cadastro?produtor=1" className="btn-primary">
            Criar conta de produtor
          </Link>
          <Link href="/entrar" className="btn-ghost">
            Já tenho conta
          </Link>
        </div>
      </div>
    );
  }

  // Logado mas ainda sem perfil de produtor
  if (!user.organizer) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Ative seu perfil de produtor</h1>
          <p className="text-sm text-white/50">
            Só precisamos do nome que aparecerá nas páginas dos seus eventos.
          </p>
        </div>
        <CreateOrganizerForm defaultName={user.name} />
      </div>
    );
  }

  const events = await prisma.event.findMany({
    where: { organizerId: user.organizer.id },
    include: { ticketTypes: true },
    orderBy: { startsAt: "desc" },
  });

  const paidOrders = await prisma.order.findMany({
    where: { status: "PAID", event: { organizerId: user.organizer.id } },
    include: { items: true, event: true },
  });

  const grossCents = paidOrders.reduce((s, o) => s + o.subtotalCents, 0);
  const netCents = paidOrders.reduce(
    (s, o) =>
      s +
      o.items.reduce(
        (si, i) =>
          si +
          calcOrganizerNetCents(i.unitPriceCents, o.event.serviceFeeBps, o.event.feeMode) *
            i.quantity,
        0,
      ),
    0,
  );
  const ticketsSold = await prisma.ticket.count({
    where: { event: { organizerId: user.organizer.id }, status: { not: "CANCELLED" } },
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Painel do produtor</h1>
          <p className="text-sm text-white/50">{user.organizer.displayName}</p>
        </div>
        <Link href="/organizador/eventos/novo" className="btn-primary">
          + Criar evento
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Metric label="Eventos" value={String(events.length)} />
        <Metric label="Ingressos vendidos" value={String(ticketsSold)} />
        <Metric label="Vendas brutas" value={formatBRL(grossCents)} />
        <Metric label="Você recebe" value={formatBRL(netCents)} highlight />
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-bold">Seus eventos</h2>
        {events.length === 0 ? (
          <div className="card text-center text-white/50">
            <p className="mb-3">Você ainda não criou nenhum evento.</p>
            <Link href="/organizador/eventos/novo" className="btn-primary">
              Criar meu primeiro evento
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => {
              const sold = event.ticketTypes.reduce((s, t) => s + t.sold, 0);
              const capacity = event.ticketTypes.reduce((s, t) => s + t.quantity, 0);
              return (
                <Link
                  key={event.id}
                  href={`/organizador/eventos/${event.id}`}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-ink-900 p-5 transition hover:border-brand-500/40"
                >
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      <StatusBadge status={event.status} />
                      <span className="text-xs text-white/40">
                        {formatDateTime(event.startsAt)}
                      </span>
                    </div>
                    <p className="truncate font-bold">{event.title}</p>
                    <p className="truncate text-sm text-white/50">
                      {event.venueName} · {event.city}/{event.state}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">
                      {sold}
                      <span className="text-sm font-normal text-white/40">
                        /{capacity || "—"}
                      </span>
                    </p>
                    <p className="text-xs text-white/40">ingressos vendidos</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
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

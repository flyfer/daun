import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { expireStaleOrders } from "@/lib/orders";
import { getSession } from "@/lib/auth";
import { formatDateLong, formatTime } from "@/lib/dates";
import { bpsToPercent } from "@/lib/money";
import { CheckoutPanel } from "@/components/checkout-panel";
import { CoverImage } from "@/components/cover-image";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await prisma.event.findUnique({ where: { slug } });
  if (!event) return { title: "Evento não encontrado" };
  return {
    title: event.title,
    description: event.subtitle ?? event.description.slice(0, 150),
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await expireStaleOrders();

  const event = await prisma.event.findUnique({
    where: { slug },
    include: {
      organizer: true,
      ticketTypes: { where: { active: true }, orderBy: { position: "asc" } },
    },
  });

  if (!event || event.status === "DRAFT") notFound();

  const session = await getSession();
  const now = new Date();

  const ticketTypes = event.ticketTypes.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    priceCents: t.priceCents,
    maxPerOrder: Math.min(t.maxPerOrder, event.maxPerOrder),
    available: t.quantity - t.sold - t.reserved,
    notStarted: !!t.salesStartAt && t.salesStartAt > now,
    ended: !!t.salesEndAt && t.salesEndAt < now,
  }));

  return (
    <div className="space-y-8">
      {/* Capa */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-ink-900">
        <div className="relative aspect-21/9 max-h-80 w-full bg-ink-800">
          <CoverImage src={event.coverUrl} alt={event.title} />
          <div className="absolute inset-0 bg-linear-to-t from-ink-900 via-ink-900/40 to-transparent" />
        </div>

        <div className="space-y-3 p-6 sm:p-8">
          <div className="flex flex-wrap gap-2">
            <span className="badge bg-brand-600/20 text-brand-300">{event.category}</span>
            <span className="badge bg-white/5 text-white/60">{event.ageRating}</span>
            {event.status === "CANCELLED" && (
              <span className="badge bg-red-500/20 text-red-300">Evento cancelado</span>
            )}
          </div>
          <h1 className="text-3xl font-black leading-tight sm:text-4xl">{event.title}</h1>
          {event.subtitle && <p className="text-lg text-white/60">{event.subtitle}</p>}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* Conteúdo */}
        <div className="space-y-6">
          <div className="card space-y-4">
            <InfoRow
              icon="📅"
              title={capitalize(formatDateLong(event.startsAt))}
              subtitle={`Início às ${formatTime(event.startsAt)}${
                event.endsAt ? ` · término previsto ${formatTime(event.endsAt)}` : ""
              }`}
            />
            <InfoRow
              icon="📍"
              title={event.venueName}
              subtitle={`${event.address} — ${event.city}/${event.state}`}
            />
            <InfoRow
              icon="🎤"
              title={event.organizer.displayName}
              subtitle="Produtor do evento"
            />
          </div>

          <div className="card">
            <h2 className="mb-3 text-lg font-bold">Sobre o evento</h2>
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-white/70">
              {event.description}
            </div>
          </div>

          <div className="card text-sm text-white/50">
            <h2 className="mb-2 font-bold text-white">Informações de compra</h2>
            <ul className="list-inside list-disc space-y-1">
              <li>Máximo de {event.maxPerOrder} ingressos por pedido.</li>
              <li>
                {event.feeMode === "BUYER"
                  ? `Taxa de serviço de ${bpsToPercent(event.serviceFeeBps)}% somada ao valor do ingresso.`
                  : "Taxa de serviço já inclusa no valor do ingresso."}
              </li>
              <li>
                Cancelamento e reembolso conforme o Código de Defesa do Consumidor:
                arrependimento em até 7 dias da compra, desde que faltem mais de 48h para o
                evento.
              </li>
              <li>O ingresso é pessoal e o QR Code só pode ser usado uma vez.</li>
            </ul>
          </div>
        </div>

        {/* Compra */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <CheckoutPanel
            eventId={event.id}
            eventStatus={event.status}
            feeMode={event.feeMode}
            serviceFeeBps={event.serviceFeeBps}
            maxPerOrder={event.maxPerOrder}
            ticketTypes={ticketTypes}
            defaultBuyer={
              session ? { name: session.name, email: session.email } : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="text-xl">{icon}</span>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-white/50">{subtitle}</p>
      </div>
    </div>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

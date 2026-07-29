import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { EventCard } from "@/components/event-card";
import { expireStaleOrders } from "@/lib/orders";

export const dynamic = "force-dynamic";

const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME || "Ticketeira";

export default async function HomePage() {
  await expireStaleOrders();

  const events = await prisma.event.findMany({
    where: { status: "PUBLISHED", startsAt: { gte: new Date() } },
    include: { ticketTypes: true },
    orderBy: { startsAt: "asc" },
    take: 12,
  });

  const categories = [...new Set(events.map((e) => e.category))];

  return (
    <div className="space-y-14">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-brand-600/20 via-ink-900 to-accent-500/20 px-6 py-16 text-center sm:px-12">
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 size-72 rounded-full bg-accent-500/20 blur-3xl" />
        <div className="relative mx-auto max-w-2xl space-y-6">
          <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl">
            Os melhores eventos, <span className="gradient-text">um clique</span> de
            distância
          </h1>
          <p className="text-lg text-white/60">
            Compre com Pix ou cartão e receba o ingresso na hora. Produtor? Crie seu evento
            de graça e receba o repasse rápido.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/eventos" className="btn-primary">
              Ver eventos
            </Link>
            <Link href="/organizador" className="btn-ghost">
              Criar meu evento
            </Link>
          </div>
        </div>
      </section>

      {/* Categorias */}
      {categories.length > 0 && (
        <section className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <Link
              key={c}
              href={`/eventos?categoria=${encodeURIComponent(c)}`}
              className="badge border border-white/10 bg-white/5 px-4 py-2 hover:border-brand-500/50 hover:bg-white/10"
            >
              {c}
            </Link>
          ))}
        </section>
      )}

      {/* Próximos eventos */}
      <section className="space-y-5">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold">Próximos eventos</h2>
          <Link href="/eventos" className="text-sm text-brand-400 hover:text-brand-300">
            Ver todos →
          </Link>
        </div>

        {events.length === 0 ? (
          <div className="card text-center text-white/50">
            <p className="mb-3">Nenhum evento publicado ainda.</p>
            <Link href="/organizador" className="btn-primary">
              Publicar o primeiro evento
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => {
              const active = event.ticketTypes.filter((t) => t.active);
              const available = active.filter(
                (t) => t.quantity - t.sold - t.reserved > 0,
              );
              const fromCents = available.length
                ? Math.min(...available.map((t) => t.priceCents))
                : null;
              return (
                <EventCard
                  key={event.id}
                  event={event}
                  fromCents={fromCents}
                  soldOut={active.length > 0 && available.length === 0}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Para produtores */}
      <section className="grid gap-6 rounded-3xl border border-white/10 bg-ink-900 p-8 sm:grid-cols-3">
        {[
          {
            icon: "⚡",
            title: "Repasse rápido",
            text: "Receba em D+2 após o evento — ou antecipe as vendas com taxa combinada.",
          },
          {
            icon: "📊",
            title: "Painel em tempo real",
            text: "Acompanhe vendas, receita líquida e check-in ao vivo pelo celular.",
          },
          {
            icon: "🎫",
            title: "Check-in por QR Code",
            text: "Cada ingresso tem código único e validação anti-fraude na portaria.",
          },
        ].map((f) => (
          <div key={f.title} className="space-y-2">
            <div className="text-3xl">{f.icon}</div>
            <h3 className="font-bold">{f.title}</h3>
            <p className="text-sm text-white/50">{f.text}</p>
          </div>
        ))}
        <div className="sm:col-span-3">
          <Link href="/organizador" className="btn-primary">
            Começar a vender no {BRAND}
          </Link>
        </div>
      </section>
    </div>
  );
}

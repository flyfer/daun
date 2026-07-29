import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { EventCard } from "@/components/event-card";

export const dynamic = "force-dynamic";

export const metadata = { title: "Eventos" };

export default async function EventosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoria?: string; cidade?: string }>;
}) {
  const { q, categoria, cidade } = await searchParams;

  const events = await prisma.event.findMany({
    where: {
      status: "PUBLISHED",
      startsAt: { gte: new Date() },
      ...(categoria ? { category: categoria } : {}),
      ...(cidade ? { city: cidade } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q } },
              { description: { contains: q } },
              { venueName: { contains: q } },
            ],
          }
        : {}),
    },
    include: { ticketTypes: true },
    orderBy: { startsAt: "asc" },
  });

  const allCities = await prisma.event.findMany({
    where: { status: "PUBLISHED" },
    select: { city: true },
    distinct: ["city"],
    orderBy: { city: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Eventos</h1>
          <p className="text-sm text-white/50">
            {events.length} evento{events.length === 1 ? "" : "s"} com vendas abertas
          </p>
        </div>

        <form className="flex gap-2" action="/eventos">
          {categoria && <input type="hidden" name="categoria" value={categoria} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar evento, local..."
            className="input sm:w-64"
          />
          <button className="btn-ghost">Buscar</button>
        </form>
      </div>

      {(categoria || cidade || q) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-white/40">Filtros:</span>
          {[categoria, cidade, q].filter(Boolean).map((f) => (
            <span key={f} className="badge bg-brand-600/20 text-brand-300">
              {f}
            </span>
          ))}
          <Link href="/eventos" className="text-white/40 underline hover:text-white">
            limpar
          </Link>
        </div>
      )}

      {allCities.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {allCities.map((c) => (
            <Link
              key={c.city}
              href={`/eventos?cidade=${encodeURIComponent(c.city)}`}
              className={`badge border px-3 py-1.5 ${
                cidade === c.city
                  ? "border-brand-500 bg-brand-600/20 text-brand-300"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              {c.city}
            </Link>
          ))}
        </div>
      )}

      {events.length === 0 ? (
        <div className="card text-center text-white/50">
          Nenhum evento encontrado com esses filtros.
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => {
            const active = event.ticketTypes.filter((t) => t.active);
            const available = active.filter((t) => t.quantity - t.sold - t.reserved > 0);
            return (
              <EventCard
                key={event.id}
                event={event}
                fromCents={
                  available.length ? Math.min(...available.map((t) => t.priceCents)) : null
                }
                soldOut={active.length > 0 && available.length === 0}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

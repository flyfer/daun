import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { FindOrderForm } from "@/components/find-order-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Meus ingressos" };

export default async function MyTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const session = await getSession();
  const { email } = await searchParams;
  const lookupEmail = session?.email ?? email?.toLowerCase();

  if (!lookupEmail) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Meus ingressos</h1>
          <p className="text-sm text-white/50">
            Entre na sua conta ou busque pelo e-mail usado na compra.
          </p>
        </div>
        <FindOrderForm />
        <p className="text-center text-sm text-white/40">
          <Link href="/entrar" className="text-brand-400 hover:text-brand-300">
            Entrar na minha conta
          </Link>
        </p>
      </div>
    );
  }

  const orders = await prisma.order.findMany({
    where: { buyerEmail: lookupEmail, status: "PAID" },
    include: {
      event: true,
      ticket: { include: { ticketType: true }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Meus ingressos</h1>
        <p className="text-sm text-white/50">{lookupEmail}</p>
      </div>

      {orders.length === 0 ? (
        <div className="card space-y-3 text-center text-white/50">
          <p>Nenhum ingresso encontrado para este e-mail.</p>
          <Link href="/eventos" className="btn-primary">
            Ver eventos
          </Link>
        </div>
      ) : (
        orders.map((order) => (
          <div key={order.id} className="card space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Link
                  href={`/e/${order.event.slug}`}
                  className="font-bold hover:text-brand-300"
                >
                  {order.event.title}
                </Link>
                <p className="text-sm text-white/50">
                  {formatDateTime(order.event.startsAt)} · {order.event.city}/
                  {order.event.state}
                </p>
                <p className="text-xs text-white/30">
                  Pedido {order.code} · {formatBRL(order.totalCents)}
                </p>
              </div>
              <span className="badge shrink-0 bg-emerald-500/20 text-emerald-300">
                Confirmado
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {order.ticket.map((t, i) => (
                <Link
                  key={t.id}
                  href={`/ingresso/${t.code}`}
                  className={`badge border px-3 py-2 ${
                    t.status === "VALID"
                      ? "border-white/10 bg-white/5 hover:bg-white/10"
                      : "border-white/5 bg-white/5 text-white/30"
                  }`}
                >
                  🎟️ #{i + 1} {t.ticketType.name}
                  {t.status === "USED" && " · usado"}
                </Link>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

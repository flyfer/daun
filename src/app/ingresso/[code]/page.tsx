import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { formatDateLong, formatTime } from "@/lib/dates";

export const dynamic = "force-dynamic";

export const metadata = { title: "Ingresso" };

export default async function TicketPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const ticket = await prisma.ticket.findUnique({
    where: { code },
    include: { event: true, ticketType: true },
  });
  if (!ticket) notFound();

  // demais ingressos do mesmo pedido, para o comprador navegar entre eles
  const siblings = await prisma.ticket.findMany({
    where: { orderId: ticket.orderId },
    include: { ticketType: true },
    orderBy: { createdAt: "asc" },
  });

  const qr = await QRCode.toDataURL(ticket.code, { margin: 1, width: 420 });
  const index = siblings.findIndex((t) => t.id === ticket.id) + 1;

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-ink-900">
        <div className="bg-linear-to-r from-brand-600 to-accent-500 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
            Ingresso {index} de {siblings.length}
          </p>
          <h1 className="text-xl font-black leading-tight">{ticket.event.title}</h1>
        </div>

        <div className="space-y-4 p-6 text-center">
          {ticket.status === "VALID" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qr}
              alt={`QR Code do ingresso ${ticket.code}`}
              className="mx-auto size-60 rounded-2xl bg-white p-3"
            />
          ) : (
            <div className="mx-auto grid size-60 place-items-center rounded-2xl border border-white/10 bg-ink-800 text-center">
              <div>
                <p className="text-4xl">{ticket.status === "USED" ? "✅" : "🚫"}</p>
                <p className="mt-2 font-bold">
                  {ticket.status === "USED" ? "Já utilizado" : "Cancelado"}
                </p>
                {ticket.checkedInAt && (
                  <p className="text-xs text-white/40">
                    Check-in em {ticket.checkedInAt.toLocaleString("pt-BR")}
                  </p>
                )}
              </div>
            </div>
          )}

          <p className="font-mono text-sm tracking-widest text-white/60">{ticket.code}</p>

          <div className="space-y-1 border-t border-dashed border-white/15 pt-4 text-sm">
            <p className="font-semibold">{ticket.ticketType.name}</p>
            <p className="text-white/60">{ticket.attendeeName}</p>
            <p className="text-white/40">
              {capitalize(formatDateLong(ticket.event.startsAt))} ·{" "}
              {formatTime(ticket.event.startsAt)}
            </p>
            <p className="text-white/40">
              {ticket.event.venueName} — {ticket.event.city}/{ticket.event.state}
            </p>
          </div>
        </div>
      </div>

      {siblings.length > 1 && (
        <div className="card">
          <p className="label">Outros ingressos deste pedido</p>
          <div className="flex flex-wrap gap-2">
            {siblings.map((t, i) => (
              <a
                key={t.id}
                href={`/ingresso/${t.code}`}
                className={`badge border px-3 py-1.5 ${
                  t.id === ticket.id
                    ? "border-brand-500 bg-brand-600/20 text-brand-300"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                #{i + 1} {t.ticketType.name}
              </a>
            ))}
          </div>
        </div>
      )}

      <p className="text-center text-xs text-white/30">
        Não compartilhe este QR Code. Ele só pode ser lido uma vez na portaria.
      </p>
    </div>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

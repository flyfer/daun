import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { CheckinConsole } from "@/components/checkin-console";

export const dynamic = "force-dynamic";
export const metadata = { title: "Check-in" };

export default async function CheckinPage({
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
  });
  if (!event) notFound();

  const [total, used] = await Promise.all([
    prisma.ticket.count({ where: { eventId: event.id, status: { not: "CANCELLED" } } }),
    prisma.ticket.count({ where: { eventId: event.id, status: "USED" } }),
  ]);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link
          href={`/organizador/eventos/${event.id}`}
          className="text-sm text-white/40 hover:text-white"
        >
          ← {event.title}
        </Link>
        <h1 className="text-3xl font-bold">Check-in</h1>
        <p className="text-sm text-white/50">
          Leia o QR Code com o leitor da portaria ou digite o código do ingresso.
        </p>
      </div>

      <CheckinConsole eventId={event.id} initialUsed={used} total={total} />
    </div>
  );
}

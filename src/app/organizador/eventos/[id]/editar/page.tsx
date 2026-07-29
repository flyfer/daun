import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { toDatetimeLocal } from "@/lib/dates";
import { EventForm } from "@/components/event-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Editar evento" };

export default async function EditEventPage({
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={`/organizador/eventos/${event.id}`}
          className="text-sm text-white/40 hover:text-white"
        >
          ← Voltar ao evento
        </Link>
        <h1 className="mt-1 text-3xl font-bold">Editar evento</h1>
        <p className="text-sm text-white/50">
          Os lotes de ingresso são gerenciados na tela do evento.
        </p>
      </div>
      <EventForm
        defaultFeeBps={Number(process.env.DEFAULT_SERVICE_FEE_BPS ?? 1000)}
        eventId={event.id}
        initialValues={{
          title: event.title,
          subtitle: event.subtitle ?? "",
          description: event.description,
          category: event.category,
          coverUrl: event.coverUrl ?? "",
          venueName: event.venueName,
          address: event.address,
          city: event.city,
          state: event.state,
          startsAt: toDatetimeLocal(event.startsAt),
          endsAt: event.endsAt ? toDatetimeLocal(event.endsAt) : "",
          ageRating: event.ageRating,
          maxPerOrder: String(event.maxPerOrder),
          serviceFeeBps: String(event.serviceFeeBps),
          feeMode: event.feeMode as "BUYER" | "ORGANIZER",
        }}
      />
    </div>
  );
}

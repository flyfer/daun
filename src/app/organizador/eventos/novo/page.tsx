import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { EventForm } from "@/components/event-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Criar evento" };

export default async function NewEventPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  if (!user.organizer) redirect("/organizador");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Criar evento</h1>
        <p className="text-sm text-white/50">
          Publique agora ou salve como rascunho e ajuste depois.
        </p>
      </div>
      <EventForm
        defaultFeeBps={Number(process.env.DEFAULT_SERVICE_FEE_BPS ?? 1000)}
      />
    </div>
  );
}

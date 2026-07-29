"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function EventActions({
  eventId,
  status,
  slug,
}: {
  eventId: string;
  status: string;
  slug: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function change(next: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/organizer/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Não foi possível atualizar.");
    router.refresh();
  }

  async function copyLink() {
    const url = `${window.location.origin}/e/${slug}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "DRAFT" && (
        <button className="btn-primary" disabled={busy} onClick={() => change("PUBLISHED")}>
          Publicar e abrir vendas
        </button>
      )}
      {status === "PUBLISHED" && (
        <>
          <button className="btn-ghost" disabled={busy} onClick={() => change("DRAFT")}>
            Pausar vendas
          </button>
          <button className="btn-ghost" disabled={busy} onClick={() => change("FINISHED")}>
            Encerrar evento
          </button>
        </>
      )}
      {status !== "CANCELLED" && (
        <button
          className="btn-ghost !border-red-500/30 !text-red-300"
          disabled={busy}
          onClick={() => change("CANCELLED")}
        >
          Cancelar evento
        </button>
      )}
      {status === "CANCELLED" && (
        <button className="btn-ghost" disabled={busy} onClick={() => change("DRAFT")}>
          Reativar como rascunho
        </button>
      )}
      <button className="btn-ghost" onClick={copyLink}>
        {copied ? "Link copiado ✓" : "Copiar link de venda"}
      </button>
      {error && <span className="text-sm text-red-300">{error}</span>}
    </div>
  );
}

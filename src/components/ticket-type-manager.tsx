"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatBRL, parseBRLToCents } from "@/lib/money";

type TT = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  quantity: number;
  sold: number;
  reserved: number;
  active: boolean;
};

export function TicketTypeManager({
  eventId,
  ticketTypes,
  feeMode,
  serviceFeeBps,
}: {
  eventId: string;
  ticketTypes: TT[];
  feeMode: string;
  serviceFeeBps: number;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [novo, setNovo] = useState({ name: "", price: "", quantity: "" });

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError(null);
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Não foi possível concluir.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function addTicketType() {
    const ok = await call(`/api/organizer/events/${eventId}/ticket-types`, "POST", {
      name: novo.name,
      priceCents: parseBRLToCents(novo.price || "0"),
      quantity: Number(novo.quantity) || 0,
    });
    if (ok) {
      setNovo({ name: "", price: "", quantity: "" });
      setAdding(false);
    }
  }

  return (
    <div className="space-y-3">
      {ticketTypes.map((t) => {
        const available = t.quantity - t.sold - t.reserved;
        const netUnit =
          feeMode === "ORGANIZER"
            ? t.priceCents - Math.round((t.priceCents * serviceFeeBps) / 10000)
            : t.priceCents;
        return (
          <div
            key={t.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-ink-900 p-5"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold">{t.name}</p>
                {!t.active && (
                  <span className="badge bg-white/10 text-white/50">Inativo</span>
                )}
              </div>
              {t.description && (
                <p className="text-xs text-white/40">{t.description}</p>
              )}
              <p className="mt-1 text-sm text-white/60">
                {t.priceCents === 0 ? "Gratuito" : formatBRL(t.priceCents)}
                {t.priceCents > 0 && (
                  <span className="text-white/35">
                    {" "}
                    · líquido {formatBRL(netUnit)}
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-6 text-sm">
              <div className="text-right">
                <p className="font-bold">
                  {t.sold}
                  <span className="font-normal text-white/40">/{t.quantity}</span>
                </p>
                <p className="text-xs text-white/40">
                  {available} disponíveis
                  {t.reserved > 0 && ` · ${t.reserved} reservados`}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={busy}
                  onClick={() =>
                    call(`/api/organizer/ticket-types/${t.id}`, "PATCH", {
                      active: !t.active,
                    })
                  }
                  className="btn-ghost !px-3 !py-1.5 !text-xs"
                >
                  {t.active ? "Desativar" : "Ativar"}
                </button>
                {t.sold === 0 && t.reserved === 0 && (
                  <button
                    disabled={busy}
                    onClick={() => call(`/api/organizer/ticket-types/${t.id}`, "DELETE")}
                    className="btn-ghost !border-red-500/30 !px-3 !py-1.5 !text-xs !text-red-300"
                  >
                    Excluir
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {adding ? (
        <div className="card space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label">Nome do lote</label>
              <input
                className="input"
                value={novo.name}
                onChange={(e) => setNovo({ ...novo, name: e.target.value })}
                placeholder="2º lote — Pista"
              />
            </div>
            <div>
              <label className="label">Preço (R$)</label>
              <input
                className="input"
                value={novo.price}
                onChange={(e) => setNovo({ ...novo, price: e.target.value })}
                placeholder="100,00"
              />
            </div>
            <div>
              <label className="label">Quantidade</label>
              <input
                className="input"
                inputMode="numeric"
                value={novo.quantity}
                onChange={(e) => setNovo({ ...novo, quantity: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={busy} onClick={addTicketType}>
              Adicionar lote
            </button>
            <button className="btn-ghost" onClick={() => setAdding(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button className="btn-ghost" onClick={() => setAdding(true)}>
          + Novo lote
        </button>
      )}

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

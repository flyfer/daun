"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseBRLToCents, formatBRL, bpsToPercent } from "@/lib/money";

type TicketRow = {
  name: string;
  description: string;
  price: string;
  quantity: string;
  maxPerOrder: string;
};

const CATEGORIES = [
  "Show",
  "Festa",
  "Teatro",
  "Curso",
  "Congresso",
  "Esporte",
  "Gastronomia",
  "Religioso",
  "Outro",
];

const emptyRow = (): TicketRow => ({
  name: "",
  description: "",
  price: "",
  quantity: "",
  maxPerOrder: "6",
});

export type EventFormValues = {
  title: string;
  subtitle: string;
  description: string;
  category: string;
  coverUrl: string;
  venueName: string;
  address: string;
  city: string;
  state: string;
  startsAt: string;
  endsAt: string;
  ageRating: string;
  maxPerOrder: string;
  serviceFeeBps: string;
  feeMode: "BUYER" | "ORGANIZER";
};

export function EventForm({
  defaultFeeBps,
  eventId,
  initialValues,
}: {
  defaultFeeBps: number;
  eventId?: string;
  initialValues?: EventFormValues;
}) {
  const router = useRouter();
  const isEdit = Boolean(eventId);
  const [form, setForm] = useState<EventFormValues>(
    initialValues ?? {
      title: "",
      subtitle: "",
      description: "",
      category: "Show",
      coverUrl: "",
      venueName: "",
      address: "",
      city: "",
      state: "",
      startsAt: "",
      endsAt: "",
      ageRating: "Livre",
      maxPerOrder: "6",
      serviceFeeBps: String(defaultFeeBps),
      feeMode: "BUYER",
    },
  );
  const [rows, setRows] = useState<TicketRow[]>([emptyRow()]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [k]: e.target.value });

  const updateRow = (i: number, patch: Partial<TicketRow>) =>
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  async function submit(publish: boolean) {
    setError(null);
    setLoading(true);
    try {
      const url = isEdit ? `/api/organizer/events/${eventId}` : "/api/organizer/events";
      const body = isEdit
        ? {
            ...form,
            maxPerOrder: Number(form.maxPerOrder) || 6,
            serviceFeeBps: Number(form.serviceFeeBps) || defaultFeeBps,
          }
        : {
            ...form,
            maxPerOrder: Number(form.maxPerOrder) || 6,
            serviceFeeBps: Number(form.serviceFeeBps) || defaultFeeBps,
            publish,
            ticketTypes: rows
              .filter((r) => r.name.trim())
              .map((r) => ({
                name: r.name,
                description: r.description || undefined,
                priceCents: parseBRLToCents(r.price || "0"),
                quantity: Number(r.quantity) || 0,
                maxPerOrder: Number(r.maxPerOrder) || 6,
              })),
          };
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(
          data.error ?? (isEdit ? "Não foi possível salvar as alterações." : "Não foi possível criar o evento."),
        );
      const id = isEdit ? eventId : data.id;
      router.push(`/organizador/eventos/${id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
      setLoading(false);
    }
  }

  const feeBps = Number(form.serviceFeeBps) || 0;

  return (
    <div className="space-y-6">
      <section className="card space-y-4">
        <h2 className="font-bold">Informações do evento</h2>
        <div>
          <label className="label">Nome do evento</label>
          <input className="input" value={form.title} onChange={set("title")} />
        </div>
        <div>
          <label className="label">Subtítulo (opcional)</label>
          <input className="input" value={form.subtitle} onChange={set("subtitle")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Categoria</label>
            <select className="input" value={form.category} onChange={set("category")}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Classificação</label>
            <select className="input" value={form.ageRating} onChange={set("ageRating")}>
              {["Livre", "10 anos", "12 anos", "14 anos", "16 anos", "18 anos"].map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">URL da imagem de capa (opcional)</label>
          <input
            className="input"
            value={form.coverUrl}
            onChange={set("coverUrl")}
            placeholder="https://..."
          />
        </div>
        <div>
          <label className="label">Descrição</label>
          <textarea
            className="input min-h-32"
            value={form.description}
            onChange={set("description")}
            placeholder="Line-up, atrações, o que está incluso, regras de entrada..."
          />
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="font-bold">Data e local</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Início</label>
            <input
              type="datetime-local"
              className="input"
              value={form.startsAt}
              onChange={set("startsAt")}
            />
          </div>
          <div>
            <label className="label">Término (opcional)</label>
            <input
              type="datetime-local"
              className="input"
              value={form.endsAt}
              onChange={set("endsAt")}
            />
          </div>
        </div>
        <div>
          <label className="label">Local</label>
          <input
            className="input"
            value={form.venueName}
            onChange={set("venueName")}
            placeholder="Casa de shows, clube, auditório..."
          />
        </div>
        <div>
          <label className="label">Endereço</label>
          <input className="input" value={form.address} onChange={set("address")} />
        </div>
        <div className="grid grid-cols-[1fr_100px] gap-4">
          <div>
            <label className="label">Cidade</label>
            <input className="input" value={form.city} onChange={set("city")} />
          </div>
          <div>
            <label className="label">UF</label>
            <input
              className="input uppercase"
              maxLength={2}
              value={form.state}
              onChange={set("state")}
            />
          </div>
        </div>
      </section>

      {!isEdit && (
      <section className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Ingressos</h2>
          <button
            onClick={() => setRows([...rows, emptyRow()])}
            className="text-sm text-brand-400 hover:text-brand-300"
          >
            + adicionar lote
          </button>
        </div>

        {rows.map((row, i) => {
          const priceCents = parseBRLToCents(row.price || "0");
          const fee = Math.round((priceCents * feeBps) / 10000);
          return (
            <div key={i} className="space-y-3 rounded-xl border border-white/10 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wide text-white/40">
                  Lote {i + 1}
                </p>
                {rows.length > 1 && (
                  <button
                    onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    remover
                  </button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Nome</label>
                  <input
                    className="input"
                    value={row.name}
                    onChange={(e) => updateRow(i, { name: e.target.value })}
                    placeholder="1º lote — Pista"
                  />
                </div>
                <div>
                  <label className="label">Descrição (opcional)</label>
                  <input
                    className="input"
                    value={row.description}
                    onChange={(e) => updateRow(i, { description: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Preço (R$)</label>
                  <input
                    className="input"
                    value={row.price}
                    onChange={(e) => updateRow(i, { price: e.target.value })}
                    placeholder="80,00"
                  />
                </div>
                <div>
                  <label className="label">Quantidade</label>
                  <input
                    className="input"
                    inputMode="numeric"
                    value={row.quantity}
                    onChange={(e) => updateRow(i, { quantity: e.target.value })}
                    placeholder="200"
                  />
                </div>
                <div>
                  <label className="label">Máx. por pedido</label>
                  <input
                    className="input"
                    inputMode="numeric"
                    value={row.maxPerOrder}
                    onChange={(e) => updateRow(i, { maxPerOrder: e.target.value })}
                  />
                </div>
              </div>
              {priceCents > 0 && (
                <p className="text-xs text-white/40">
                  {form.feeMode === "BUYER"
                    ? `Comprador paga ${formatBRL(priceCents + fee)} · você recebe ${formatBRL(priceCents)} por ingresso`
                    : `Comprador paga ${formatBRL(priceCents)} · você recebe ${formatBRL(priceCents - fee)} por ingresso`}
                </p>
              )}
            </div>
          );
        })}
      </section>
      )}

      <section className="card space-y-4">
        <h2 className="font-bold">Regras de venda</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Máx. ingressos por pedido</label>
            <input
              className="input"
              inputMode="numeric"
              value={form.maxPerOrder}
              onChange={set("maxPerOrder")}
            />
          </div>
          <div>
            <label className="label">Taxa de serviço (bps)</label>
            <input
              className="input"
              inputMode="numeric"
              value={form.serviceFeeBps}
              onChange={set("serviceFeeBps")}
            />
            <p className="mt-1 text-xs text-white/40">= {bpsToPercent(feeBps)}%</p>
          </div>
          <div>
            <label className="label">Quem paga a taxa</label>
            <select
              className="input"
              value={form.feeMode}
              onChange={(e) =>
                setForm({ ...form, feeMode: e.target.value as "BUYER" | "ORGANIZER" })
              }
            >
              <option value="BUYER">Comprador (somada ao preço)</option>
              <option value="ORGANIZER">Produtor (absorvida)</option>
            </select>
          </div>
        </div>
      </section>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        {isEdit ? (
          <>
            <button className="btn-primary" disabled={loading} onClick={() => submit(true)}>
              {loading ? "Salvando..." : "Salvar alterações"}
            </button>
            <button
              className="btn-ghost"
              disabled={loading}
              onClick={() => router.push(`/organizador/eventos/${eventId}`)}
            >
              Cancelar
            </button>
          </>
        ) : (
          <>
            <button
              className="btn-primary"
              disabled={loading}
              onClick={() => submit(true)}
            >
              {loading ? "Salvando..." : "Publicar evento"}
            </button>
            <button className="btn-ghost" disabled={loading} onClick={() => submit(false)}>
              Salvar como rascunho
            </button>
          </>
        )}
      </div>
    </div>
  );
}

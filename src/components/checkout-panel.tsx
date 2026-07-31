"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatBRL, bpsToPercent } from "@/lib/money";
import { MpCardBrick, type MpCardFormData } from "@/components/mp-card-brick";

type TicketTypeView = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  maxPerOrder: number;
  available: number;
  notStarted: boolean;
  ended: boolean;
};

type Props = {
  eventId: string;
  eventStatus: string;
  feeMode: string;
  serviceFeeBps: number;
  maxPerOrder: number;
  ticketTypes: TicketTypeView[];
  defaultBuyer?: { name: string; email: string };
};

export function CheckoutPanel({
  eventId,
  eventStatus,
  feeMode,
  serviceFeeBps,
  maxPerOrder,
  ticketTypes,
  defaultBuyer,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<"PIX" | "CARD">("PIX");
  const [buyer, setBuyer] = useState({
    name: defaultBuyer?.name ?? "",
    email: defaultBuyer?.email ?? "",
    document: "",
    phone: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    let subtotal = 0;
    let fee = 0;
    let count = 0;
    for (const t of ticketTypes) {
      const q = qty[t.id] ?? 0;
      if (!q) continue;
      count += q;
      subtotal += t.priceCents * q;
      if (t.priceCents > 0 && feeMode === "BUYER") {
        fee += Math.round((t.priceCents * serviceFeeBps) / 10000) * q;
      }
    }
    return { subtotal, fee, total: subtotal + fee, count };
  }, [qty, ticketTypes, feeMode, serviceFeeBps]);

  const salesClosed =
    eventStatus !== "PUBLISHED" ||
    ticketTypes.length === 0 ||
    ticketTypes.every((t) => t.available <= 0 || t.ended);

  function setQuantity(t: TicketTypeView, next: number) {
    const otherCount = Object.entries(qty)
      .filter(([id]) => id !== t.id)
      .reduce((s, [, v]) => s + v, 0);
    const cap = Math.min(t.maxPerOrder, t.available, maxPerOrder - otherCount);
    setQty({ ...qty, [t.id]: Math.max(0, Math.min(next, cap)) });
  }

  const lines = () =>
    Object.entries(qty)
      .filter(([, q]) => q > 0)
      .map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity }));

  async function placeOrder(card?: MpCardFormData) {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId,
        paymentMethod: card ? "CARD" : method,
        buyer,
        lines: lines(),
        card: card
          ? {
              token: card.token,
              paymentMethodId: card.payment_method_id,
              issuerId: card.issuer_id,
              installments: card.installments,
            }
          : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Não foi possível concluir o pedido.");
    router.push(`/pedido/${data.code}`);
  }

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      await placeOrder();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
      setLoading(false);
    }
  }

  async function submitCard(card: MpCardFormData) {
    setError(null);
    setLoading(true);
    try {
      await placeOrder(card);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
      setLoading(false);
      throw e; // deixa o Brick saber que falhou e liberar o botão de novo
    }
  }

  if (salesClosed) {
    return (
      <div className="card text-center">
        <p className="text-lg font-bold">Vendas encerradas</p>
        <p className="mt-1 text-sm text-white/50">
          {eventStatus === "CANCELLED"
            ? "Este evento foi cancelado."
            : "Não há ingressos disponíveis para este evento."}
        </p>
      </div>
    );
  }

  return (
    <div className="card space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">
          {step === 1 ? "Escolha seus ingressos" : "Finalizar compra"}
        </h2>
        {step === 2 && (
          <button
            onClick={() => setStep(1)}
            className="text-xs text-white/50 underline hover:text-white"
          >
            voltar
          </button>
        )}
      </div>

      {step === 1 && (
        <>
          <div className="space-y-3">
            {ticketTypes.map((t) => {
              const q = qty[t.id] ?? 0;
              const unavailable = t.available <= 0 || t.ended || t.notStarted;
              return (
                <div
                  key={t.id}
                  className={`rounded-xl border p-4 ${
                    unavailable ? "border-white/5 opacity-50" : "border-white/10"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{t.name}</p>
                      {t.description && (
                        <p className="text-xs text-white/40">{t.description}</p>
                      )}
                      <p className="mt-1 text-sm font-semibold">
                        {t.priceCents === 0 ? "Gratuito" : formatBRL(t.priceCents)}
                      </p>
                      {feeMode === "BUYER" && t.priceCents > 0 && (
                        <p className="text-xs text-white/40">
                          + {formatBRL(Math.round((t.priceCents * serviceFeeBps) / 10000))}{" "}
                          de taxa
                        </p>
                      )}
                    </div>

                    {unavailable ? (
                      <span className="badge shrink-0 bg-white/5 text-white/50">
                        {t.notStarted
                          ? "Em breve"
                          : t.ended
                            ? "Encerrado"
                            : "Esgotado"}
                      </span>
                    ) : (
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          onClick={() => setQuantity(t, q - 1)}
                          disabled={q === 0}
                          className="size-8 rounded-lg border border-white/10 hover:bg-white/10 disabled:opacity-30"
                        >
                          −
                        </button>
                        <span className="w-6 text-center font-semibold">{q}</span>
                        <button
                          onClick={() => setQuantity(t, q + 1)}
                          className="size-8 rounded-lg border border-white/10 hover:bg-white/10"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                  {!unavailable && t.available <= 10 && (
                    <p className="mt-2 text-xs text-amber-400">
                      Últimas {t.available} unidades
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <Totals totals={totals} feeMode={feeMode} serviceFeeBps={serviceFeeBps} />

          <button
            className="btn-primary w-full"
            disabled={totals.count === 0}
            onClick={() => setStep(2)}
          >
            Continuar
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <div className="space-y-3">
            <div>
              <label className="label">Nome completo</label>
              <input
                className="input"
                value={buyer.name}
                onChange={(e) => setBuyer({ ...buyer, name: e.target.value })}
                placeholder="Como está no documento"
              />
            </div>
            <div>
              <label className="label">E-mail</label>
              <input
                className="input"
                type="email"
                value={buyer.email}
                onChange={(e) => setBuyer({ ...buyer, email: e.target.value })}
                placeholder="voce@email.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">CPF</label>
                <input
                  className="input"
                  value={buyer.document}
                  onChange={(e) => setBuyer({ ...buyer, document: e.target.value })}
                  placeholder="000.000.000-00"
                />
              </div>
              <div>
                <label className="label">Celular</label>
                <input
                  className="input"
                  value={buyer.phone}
                  onChange={(e) => setBuyer({ ...buyer, phone: e.target.value })}
                  placeholder="(11) 90000-0000"
                />
              </div>
            </div>
          </div>

          {totals.total > 0 && (
            <div className="space-y-3">
              <p className="label !mb-0">Forma de pagamento</p>
              <div className="grid grid-cols-2 gap-2">
                {(["PIX", "CARD"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMethod(m)}
                    className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                      method === m
                        ? "border-brand-500 bg-brand-600/20 text-white"
                        : "border-white/10 text-white/60 hover:bg-white/5"
                    }`}
                  >
                    {m === "PIX" ? "Pix" : "Cartão de crédito"}
                  </button>
                ))}
              </div>

              {method === "CARD" && (
                <MpCardBrick
                  amountCents={totals.total}
                  payerEmail={buyer.email}
                  onSubmit={submitCard}
                />
              )}
            </div>
          )}

          <Totals totals={totals} feeMode={feeMode} serviceFeeBps={serviceFeeBps} />

          {error && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          )}

          {!(totals.total > 0 && method === "CARD") && (
            <button className="btn-primary w-full" disabled={loading} onClick={submit}>
              {loading
                ? "Processando..."
                : totals.total === 0
                  ? "Confirmar inscrição"
                  : "Gerar Pix"}
            </button>
          )}

          <p className="text-center text-xs text-white/30">
            Ao continuar você concorda com os termos de uso e a política de privacidade.
          </p>
        </>
      )}
    </div>
  );
}

function Totals({
  totals,
  feeMode,
  serviceFeeBps,
}: {
  totals: { subtotal: number; fee: number; total: number; count: number };
  feeMode: string;
  serviceFeeBps: number;
}) {
  if (totals.count === 0) return null;
  return (
    <div className="space-y-1.5 rounded-xl bg-ink-800 p-4 text-sm">
      <Row label={`Ingressos (${totals.count})`} value={formatBRL(totals.subtotal)} />
      {feeMode === "BUYER" && totals.fee > 0 && (
        <Row
          label={`Taxa de serviço (${bpsToPercent(serviceFeeBps)}%)`}
          value={formatBRL(totals.fee)}
        />
      )}
      <div className="my-2 border-t border-white/10" />
      <div className="flex justify-between text-base font-bold">
        <span>Total</span>
        <span>{formatBRL(totals.total)}</span>
      </div>
    </div>
  );
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between text-white/60">
    <span>{label}</span>
    <span>{value}</span>
  </div>
);

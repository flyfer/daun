"use client";

import { useEffect, useRef, useState } from "react";
import { QrScanner } from "@/components/qr-scanner";

type Result = {
  result: string;
  message: string;
  attendee?: string;
  ticketType?: string;
  code: string;
  at: Date;
};

const TONE: Record<string, string> = {
  OK: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  ALREADY_USED: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  WRONG_EVENT: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  CANCELLED: "border-red-500/40 bg-red-500/10 text-red-200",
  INVALID: "border-red-500/40 bg-red-500/10 text-red-200",
};

const ICON: Record<string, string> = {
  OK: "✅",
  ALREADY_USED: "⚠️",
  WRONG_EVENT: "⚠️",
  CANCELLED: "🚫",
  INVALID: "❌",
};

export function CheckinConsole({
  eventId,
  initialUsed,
  total,
}: {
  eventId: string;
  initialUsed: number;
  total: number;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [used, setUsed] = useState(initialUsed);
  const [history, setHistory] = useState<Result[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Leitores de QR de portaria funcionam como teclado: mantemos o foco no campo.
  useEffect(() => {
    inputRef.current?.focus();
  }, [history]);

  const busyRef = useRef(false);

  async function submitCode(value: string) {
    if (!value || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const res = await fetch("/api/organizer/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: value, eventId }),
      });
      const data = await res.json();
      const entry: Result = {
        result: data.result ?? "INVALID",
        message: data.message ?? data.error ?? "Erro na validação.",
        attendee: data.attendee,
        ticketType: data.ticketType,
        code: value,
        at: new Date(),
      };
      setHistory((h) => [entry, ...h].slice(0, 30));
      if (entry.result === "OK") setUsed((u) => u + 1);
      setCode("");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function validate(e: React.FormEvent) {
    e.preventDefault();
    submitCode(code.trim());
  }

  function handleScan(value: string) {
    const clean = value.trim();
    setCode(clean);
    submitCode(clean);
  }

  const last = history[0];

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-white/40">
              Entradas validadas
            </p>
            <p className="text-3xl font-bold">
              {used}
              <span className="text-lg font-normal text-white/40">/{total}</span>
            </p>
          </div>
          <div className="h-2 w-32 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-linear-to-r from-brand-500 to-accent-500 transition-all"
              style={{ width: `${total ? (used / total) * 100 : 0}%` }}
            />
          </div>
        </div>

        <form onSubmit={validate} className="flex gap-2">
          <input
            ref={inputRef}
            className="input font-mono uppercase"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="TKT-XXXX-XXXX-XXXX"
            autoComplete="off"
          />
          <button className="btn-primary" disabled={busy}>
            {busy ? "..." : "Validar"}
          </button>
        </form>

        <div className="mt-3">
          <QrScanner onScan={handleScan} />
        </div>
      </div>

      {last && (
        <div className={`rounded-2xl border p-6 text-center ${TONE[last.result]}`}>
          <p className="text-5xl">{ICON[last.result]}</p>
          <p className="mt-2 text-xl font-bold">{last.message}</p>
          {last.attendee && (
            <p className="mt-1 text-sm opacity-80">
              {last.attendee} · {last.ticketType}
            </p>
          )}
          <p className="mt-1 font-mono text-xs opacity-50">{last.code}</p>
        </div>
      )}

      {history.length > 1 && (
        <div className="card">
          <p className="label">Histórico da sessão</p>
          <div className="divide-y divide-white/5">
            {history.slice(1).map((h, i) => (
              <div key={i} className="flex items-center justify-between py-2 text-sm">
                <span className="flex items-center gap-2">
                  <span>{ICON[h.result]}</span>
                  <span className="font-mono text-xs text-white/50">{h.code}</span>
                </span>
                <span className="text-xs text-white/40">
                  {h.at.toLocaleTimeString("pt-BR")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

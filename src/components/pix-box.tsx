"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function PixBox({
  code,
  qrCodeImage,
  payload,
  expiresAt,
  allowSimulation,
}: {
  code: string;
  qrCodeImage: string | null;
  payload: string | null;
  expiresAt: string | null;
  allowSimulation: boolean;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [left, setLeft] = useState<string>("");
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    if (!expiresAt) return;
    const target = new Date(expiresAt).getTime();
    const update = () => {
      const diff = target - Date.now();
      if (diff <= 0) return setLeft("expirado");
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setLeft(`${m}:${String(s).padStart(2, "0")}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  async function copy() {
    if (!payload) return;
    await navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function simulate() {
    setSimulating(true);
    await fetch("/api/payments/mock/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    router.refresh();
  }

  return (
    <div className="card space-y-4 text-center">
      <div>
        <h2 className="text-lg font-bold">Pague com Pix para garantir seus ingressos</h2>
        {left && (
          <p className="text-sm text-white/50">
            O código expira em <span className="font-mono text-amber-400">{left}</span>
          </p>
        )}
      </div>

      {qrCodeImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qrCodeImage}
          alt="QR Code do Pix"
          className="mx-auto size-56 rounded-xl bg-white p-2"
        />
      )}

      {payload && (
        <>
          <p className="break-all rounded-xl bg-ink-800 p-3 text-left font-mono text-[11px] leading-relaxed text-white/50">
            {payload}
          </p>
          <button onClick={copy} className="btn-primary w-full">
            {copied ? "Código copiado ✓" : "Copiar código Pix"}
          </button>
        </>
      )}

      <p className="text-xs text-white/40">
        Assim que o banco confirmar, esta página libera seus ingressos automaticamente.
      </p>

      {allowSimulation && (
        <div className="rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 p-4">
          <p className="mb-2 text-xs text-amber-300/80">
            Ambiente de teste (PAYMENT_PROVIDER=mock)
          </p>
          <button onClick={simulate} disabled={simulating} className="btn-ghost w-full">
            {simulating ? "Confirmando..." : "Simular pagamento do Pix"}
          </button>
        </div>
      )}
    </div>
  );
}

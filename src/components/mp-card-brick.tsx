"use client";

import { useEffect, useRef } from "react";
import { initMercadoPago, Payment } from "@mercadopago/sdk-react";

let initialized = false;

export type MpCardFormData = {
  token: string;
  payment_method_id: string;
  issuer_id?: string;
  installments: number;
};

export function MpCardBrick({
  amountCents,
  payerEmail,
  onSubmit,
}: {
  amountCents: number;
  payerEmail: string;
  onSubmit: (data: MpCardFormData) => Promise<void>;
}) {
  const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  useEffect(() => {
    if (!initialized && publicKey) {
      initMercadoPago(publicKey, { locale: "pt-BR" });
      initialized = true;
    }
  }, [publicKey]);

  if (!publicKey) {
    return (
      <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-300/80">
        Pagamento por cartão indisponível: NEXT_PUBLIC_MP_PUBLIC_KEY não configurada.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 p-1">
      <Payment
        initialization={{
          amount: amountCents / 100,
          payer: { email: payerEmail || undefined },
        }}
        customization={{
          paymentMethods: {
            creditCard: "all",
            debitCard: "all",
            maxInstallments: 12,
          },
          visual: { style: { theme: "dark" } },
        }}
        onSubmit={async ({ formData }) => {
          if (!formData) throw new Error("Não foi possível ler os dados do cartão.");
          await onSubmitRef.current({
            token: formData.token,
            payment_method_id: formData.payment_method_id,
            issuer_id: formData.issuer_id,
            installments: formData.installments,
          });
        }}
      />
    </div>
  );
}

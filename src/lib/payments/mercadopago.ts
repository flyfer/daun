import { randomUUID } from "node:crypto";
import type {
  CreateChargeInput,
  CreateChargeResult,
  PaymentProvider,
  WebhookResult,
} from "./types";

const API = "https://api.mercadopago.com";

/**
 * Integração real com o Mercado Pago (Pix + cartão de crédito).
 *
 * Configuração:
 *   1. Crie a aplicação em mercadopago.com.br/developers/panel/app
 *   2. Copie o Access Token para MP_ACCESS_TOKEN no .env
 *   3. Cadastre o webhook: {NEXT_PUBLIC_APP_URL}/api/webhooks/payments
 *   4. PAYMENT_PROVIDER="mercadopago"
 *
 * Cartão: o número NUNCA passa pelo servidor. O front usa o SDK
 * (https://sdk.mercadopago.com/js/v2) para gerar um token e envia só o token.
 */
export class MercadoPagoProvider implements PaymentProvider {
  readonly name = "mercadopago";

  private get token() {
    const t = process.env.MP_ACCESS_TOKEN;
    if (!t) throw new Error("MP_ACCESS_TOKEN não configurado no .env");
    return t;
  }

  private async request(path: string, init?: RequestInit) {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message =
        (json as { message?: string })?.message ?? `Erro ${res.status} no Mercado Pago`;
      throw new Error(message);
    }
    return json as Record<string, unknown>;
  }

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    const [firstName, ...rest] = input.payer.name.split(" ");
    const payer: Record<string, unknown> = {
      email: input.payer.email,
      first_name: firstName,
      last_name: rest.join(" ") || firstName,
    };
    if (input.payer.document) {
      const digits = input.payer.document.replace(/\D/g, "");
      payer.identification = {
        type: digits.length > 11 ? "CNPJ" : "CPF",
        number: digits,
      };
    }

    const body: Record<string, unknown> = {
      transaction_amount: Number((input.amountCents / 100).toFixed(2)),
      description: input.description,
      external_reference: input.orderCode,
      notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/payments`,
      payer,
    };

    if (input.method === "PIX") {
      body.payment_method_id = "pix";
      body.date_of_expiration = toMpDate(input.expiresAt);
    } else {
      if (!input.card?.token) {
        throw new Error(
          "Token do cartão ausente. Gere o token no navegador com o SDK do Mercado Pago antes de enviar.",
        );
      }
      body.token = input.card.token;
      body.installments = input.card.installments ?? 1;
      if (input.card.paymentMethodId) body.payment_method_id = input.card.paymentMethodId;
      if (input.card.issuerId) body.issuer_id = input.card.issuerId;
    }

    const payment = await this.request("/v1/payments", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "X-Idempotency-Key": `${input.orderId}-${randomUUID()}` },
    });

    const status = String(payment.status ?? "pending");
    const poi = payment.point_of_interaction as
      | { transaction_data?: { qr_code?: string; qr_code_base64?: string } }
      | undefined;
    const card = payment.card as
      | { last_four_digits?: string; }
      | undefined;

    return {
      provider: this.name,
      providerRef: String(payment.id),
      status: mapStatus(status) === "PAID" ? "PAID" : status === "rejected" ? "REJECTED" : "PENDING",
      pixQrCode: poi?.transaction_data?.qr_code,
      pixQrCodeImage: poi?.transaction_data?.qr_code_base64
        ? `data:image/png;base64,${poi.transaction_data.qr_code_base64}`
        : undefined,
      cardBrand: payment.payment_method_id ? String(payment.payment_method_id) : undefined,
      cardLast4: card?.last_four_digits,
      message: payment.status_detail ? String(payment.status_detail) : undefined,
    };
  }

  async parseWebhook(body: unknown): Promise<WebhookResult | null> {
    const data = body as { type?: string; action?: string; data?: { id?: string } };
    const type = data.type ?? data.action?.split(".")[0];
    if (type !== "payment" || !data.data?.id) return null;

    const payment = await this.request(`/v1/payments/${data.data.id}`);
    return {
      providerRef: String(payment.id),
      status: mapStatus(String(payment.status)),
      externalId: String(data.data.id),
      eventType: data.action ?? "payment",
    };
  }

  async fetchStatus(providerRef: string): Promise<WebhookResult["status"]> {
    const payment = await this.request(`/v1/payments/${providerRef}`);
    return mapStatus(String(payment.status));
  }
}

function mapStatus(status: string): WebhookResult["status"] {
  switch (status) {
    case "approved":
    case "authorized":
      return "PAID";
    case "refunded":
    case "charged_back":
      return "REFUNDED";
    case "cancelled":
    case "rejected":
      return "CANCELLED";
    default:
      return "PENDING";
  }
}

function toMpDate(date: Date): string {
  // Mercado Pago exige offset explícito: 2026-07-28T18:30:00.000-03:00
  const pad = (n: number) => String(n).padStart(2, "0");
  const off = -date.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.000` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

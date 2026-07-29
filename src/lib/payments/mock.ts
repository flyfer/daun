import QRCode from "qrcode";
import { buildPixPayload } from "./pix-brcode";
import type {
  CreateChargeInput,
  CreateChargeResult,
  PaymentProvider,
  WebhookResult,
} from "./types";

/**
 * Provider de desenvolvimento: gera um Pix copia-e-cola válido em formato
 * (mas apontando para uma chave de teste) e aprova cartões pelo último dígito.
 * Permite rodar o fluxo completo sem conta em gateway.
 *
 * Regras do cartão no modo mock:
 *   - número terminado em 1 -> recusado
 *   - qualquer outro        -> aprovado na hora
 * O Pix fica PENDENTE até alguém chamar /api/payments/mock/confirm
 * (o botão "Simular pagamento" na tela de checkout faz isso).
 */
export class MockProvider implements PaymentProvider {
  readonly name = "mock";
  private static paid = new Set<string>();

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    const providerRef = `mock_${input.orderCode}_${Date.now().toString(36)}`;

    if (input.method === "CARD") {
      const number = (input.card?.number ?? "").replace(/\D/g, "");
      const approved = number.length >= 13 && !number.endsWith("1");
      return {
        provider: this.name,
        providerRef,
        status: approved ? "PAID" : "REJECTED",
        cardBrand: detectBrand(number),
        cardLast4: number.slice(-4),
        message: approved
          ? "Pagamento aprovado (simulado)"
          : "Cartão recusado pelo emissor (simulado — número terminado em 1)",
      };
    }

    const payload = buildPixPayload({
      pixKey: process.env.MOCK_PIX_KEY || "pagamentos@ticketeira.com.br",
      merchantName: process.env.NEXT_PUBLIC_BRAND_NAME || "TicketDaun",
      merchantCity: "SAO PAULO",
      amountCents: input.amountCents,
      txid: input.orderCode.replace(/-/g, ""),
      description: input.description,
    });

    return {
      provider: this.name,
      providerRef,
      status: "PENDING",
      pixQrCode: payload,
      pixQrCodeImage: await QRCode.toDataURL(payload, { margin: 1, width: 320 }),
    };
  }

  async parseWebhook(body: unknown): Promise<WebhookResult | null> {
    const data = body as { providerRef?: string; status?: string };
    if (!data?.providerRef) return null;
    const status = (data.status ?? "PAID") as WebhookResult["status"];
    if (status === "PAID") MockProvider.paid.add(data.providerRef);
    return { providerRef: data.providerRef, status, eventType: "mock.payment" };
  }

  async fetchStatus(providerRef: string): Promise<WebhookResult["status"]> {
    return MockProvider.paid.has(providerRef) ? "PAID" : "PENDING";
  }
}

function detectBrand(number: string): string {
  if (/^4/.test(number)) return "Visa";
  if (/^5[1-5]/.test(number)) return "Mastercard";
  if (/^3[47]/.test(number)) return "Amex";
  if (/^(606282|3841)/.test(number)) return "Hipercard";
  if (/^(4011|4312|4389|5041|5067|509|6277|6362|650)/.test(number)) return "Elo";
  return "Cartão";
}

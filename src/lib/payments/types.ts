export type PaymentMethod = "PIX" | "CARD";

export type CardInput = {
  number: string;
  holder: string;
  expMonth: number;
  expYear: number;
  cvv: string;
  installments?: number;
  /**
   * Token do cartão gerado no navegador pelo SDK do gateway.
   * Em produção é ele que trafega — os campos acima só existem para o modo mock,
   * porque PCI-DSS proíbe o número do cartão passar pelo seu servidor.
   */
  token?: string;
  paymentMethodId?: string;
  issuerId?: string;
};

export type CreateChargeInput = {
  orderId: string;
  orderCode: string;
  amountCents: number;
  method: PaymentMethod;
  description: string;
  payer: {
    name: string;
    email: string;
    document?: string | null;
    phone?: string | null;
  };
  expiresAt: Date;
  card?: CardInput;
};

export type CreateChargeResult = {
  provider: string;
  providerRef: string;
  /** PENDING enquanto aguarda pagamento; PAID quando aprovado na hora (cartão) */
  status: "PENDING" | "PAID" | "REJECTED";
  pixQrCode?: string;
  pixQrCodeImage?: string;
  cardBrand?: string;
  cardLast4?: string;
  message?: string;
};

export type WebhookResult = {
  providerRef: string;
  status: "PAID" | "PENDING" | "CANCELLED" | "REFUNDED";
  externalId?: string;
  eventType?: string;
};

export interface PaymentProvider {
  readonly name: string;
  createCharge(input: CreateChargeInput): Promise<CreateChargeResult>;
  /** Traduz o corpo do webhook do gateway para um resultado normalizado. */
  parseWebhook(body: unknown, headers: Headers): Promise<WebhookResult | null>;
  /** Consulta o status atual da cobrança (fallback quando o webhook não chega). */
  fetchStatus(providerRef: string): Promise<WebhookResult["status"]>;
}

import { MockProvider } from "./mock";
import { MercadoPagoProvider } from "./mercadopago";
import type { PaymentProvider } from "./types";

let cached: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;
  const name = (process.env.PAYMENT_PROVIDER || "mock").toLowerCase();
  switch (name) {
    case "mercadopago":
      cached = new MercadoPagoProvider();
      break;
    case "mock":
    default:
      cached = new MockProvider();
      break;
  }
  return cached;
}

export const isMockProvider = () =>
  (process.env.PAYMENT_PROVIDER || "mock").toLowerCase() === "mock";

export * from "./types";

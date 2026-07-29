/** Utilitários monetários. Todo valor trafega em centavos (Int) — nunca float. */

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Converte "R$ 1.234,56" ou "1234,56" para centavos. */
export function parseBRLToCents(input: string): number {
  const clean = input.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const value = Number.parseFloat(clean);
  if (Number.isNaN(value)) return 0;
  return Math.round(value * 100);
}

/**
 * Calcula a taxa de serviço de um ingresso.
 * feeMode BUYER     -> taxa somada ao preço (comprador paga preço + taxa)
 * feeMode ORGANIZER -> taxa absorvida pelo produtor (comprador paga só o preço)
 */
export function calcFeeCents(
  unitPriceCents: number,
  serviceFeeBps: number,
  feeMode: string,
): number {
  if (unitPriceCents === 0) return 0; // ingresso gratuito não tem taxa
  const fee = Math.round((unitPriceCents * serviceFeeBps) / 10000);
  return feeMode === "ORGANIZER" ? 0 : fee;
}

/** Quanto o produtor recebe por ingresso, líquido da taxa. */
export function calcOrganizerNetCents(
  unitPriceCents: number,
  serviceFeeBps: number,
  feeMode: string,
): number {
  if (feeMode === "ORGANIZER") {
    return unitPriceCents - Math.round((unitPriceCents * serviceFeeBps) / 10000);
  }
  return unitPriceCents;
}

export const bpsToPercent = (bps: number) => (bps / 100).toFixed(bps % 100 === 0 ? 0 : 2);

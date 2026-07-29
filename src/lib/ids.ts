import { randomBytes, randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I

function randomCode(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** Código do pedido exibido ao comprador: TK-A3B9K2 */
export const newOrderCode = () => `TK-${randomCode(6)}`;

/** Código do ingresso, único e não sequencial: TKT-A3B9-K2M7-QX41 */
export const newTicketCode = () =>
  `TKT-${randomCode(4)}-${randomCode(4)}-${randomCode(4)}`;

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base) || `evento-${randomInt(1000, 9999)}`;
  let candidate = root;
  let i = 2;
  while (await exists(candidate)) {
    candidate = `${root}-${i++}`;
    if (i > 50) return `${root}-${randomCode(4).toLowerCase()}`;
  }
  return candidate;
}

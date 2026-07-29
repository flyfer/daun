/**
 * Gerador de BR Code (Pix copia-e-cola) no padrão EMV®QRCPS do Banco Central.
 * Usado pelo provider "mock" e disponível para um modo Pix manual (chave própria).
 */

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function sanitize(text: string, max: number): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .toUpperCase()
    .slice(0, max);
}

export function buildPixPayload(opts: {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amountCents: number;
  txid: string;
  description?: string;
}): string {
  const merchantAccount = tlv("00", "br.gov.bcb.pix") + tlv("01", opts.pixKey) +
    (opts.description ? tlv("02", sanitize(opts.description, 60)) : "");

  let payload =
    tlv("00", "01") + // payload format indicator
    tlv("26", merchantAccount) +
    tlv("52", "0000") + // merchant category code
    tlv("53", "986") + // BRL
    tlv("54", (opts.amountCents / 100).toFixed(2)) +
    tlv("58", "BR") +
    tlv("59", sanitize(opts.merchantName, 25)) +
    tlv("60", sanitize(opts.merchantCity, 15)) +
    tlv("62", tlv("05", sanitize(opts.txid, 25) || "***"));

  payload += "6304";
  return payload + crc16(payload);
}

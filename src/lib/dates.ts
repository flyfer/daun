const TZ = "America/Sao_Paulo";

export function formatDateLong(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: TZ,
  }).format(date);
}

export function formatDateShort(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: TZ,
  }).format(date);
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(date);
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(date);
}

/**
 * "para input datetime-local" — YYYY-MM-DDTHH:mm no fuso America/Sao_Paulo.
 *
 * Sempre no fuso do evento (independente do fuso do servidor), para bater
 * com o que é exibido em formatDateTime/formatDateLong etc.
 */
export function toDatetimeLocal(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/**
 * Converte o valor de um input datetime-local (ex: "2026-08-22T16:00"),
 * interpretado como horário de America/Sao_Paulo, para o instante UTC
 * correspondente. O Brasil não tem mais horário de verão desde 2019, então
 * o offset -03:00 é fixo.
 */
export function parseSaoPauloDatetime(value: string): Date {
  return new Date(`${value}:00-03:00`);
}

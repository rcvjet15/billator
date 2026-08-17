/** Format a number as EUR. */
export function formatEur(n: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

export function formatKwh(n: number): string {
  return `${new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(n)} kWh`;
}

export function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

/** Pad a number/string to two digits. */
function d2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Format an ISO date string (or Date) as dd.MM.yyyy. */
export function formatDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return `${d2(date.getDate())}.${d2(date.getMonth() + 1)}.${date.getFullYear()}`;
}

/** Format an ISO date string (or Date) as dd.MM.yyyy HH:mm. */
export function formatDateWithTime(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return `${formatDate(date)} ${d2(date.getHours())}:${d2(date.getMinutes())}`;
}

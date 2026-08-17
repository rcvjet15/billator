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

/** Format an ISO date string (or Date) as a short locale date. */
export function formatDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString();
}

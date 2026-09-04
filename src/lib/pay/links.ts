import type { PaymentsSettings } from "@/lib/settings/types";

/** Round a money value to 2 decimals for rendering in a link/note. */
export function formatAmount(amount: number): string {
  return amount.toFixed(2);
}

/**
 * Expand placeholders in a template string. Supported keys:
 *   {amount}      — numeric amount (2 decimals), e.g. 58.78
 *   {note}        — note/reference (URL-encoded)
 *   {recipient}   — phone/alias (URL-encoded)
 *   {username}    — Revolut username (URL-encoded)
 *   {currency}    — currency code (lowercased), e.g. eur
 */
function expand(template: string, vars: Record<string, string>): string {
  return template.replace(
    /\{(amount|note|recipient|username|currency)\}/g,
    (_, token: string) => vars[token] ?? "",
  );
}

export interface BuildLinkParams {
  amount: number;
  note?: string;
  recipient?: string;
  settings: PaymentsSettings;
}

/** Build the Revolut.me link from the settings template (default includes currency + amount + note). */
export function buildRevolutUrl({ amount, note, recipient, settings }: BuildLinkParams): string {
  const username = recipient || settings.revolutUsername || "";
  const currency = (settings.revolutCurrency || "eur").toLowerCase();
  // Note flattened (no spaces) to keep it a single path segment when using the
  // default template; other templates may produce their own constraints.
  const flatNote = (note || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const template = settings.revolutTemplate
    ? settings.revolutTemplate
    : "https://revolut.me/{username}/{currency}{amount}/{note}";
  return expand(template, {
    username: encodeURIComponent(username),
    currency,
    amount: formatAmount(amount),
    note: encodeURIComponent(flatNote),
    recipient: encodeURIComponent(username),
  });
}

/** Build the KEKS Pay deep link from the settings template. */
export function buildKeksUrl({ amount, note, recipient, settings }: BuildLinkParams): string {
  const rec = recipient || settings.keksRecipient || "";
  const template = settings.keksTemplate
    ? settings.keksTemplate
    : "kekspay://pay?amount={amount}&note={note}&recipient={recipient}";
  return expand(template, {
    amount: formatAmount(amount),
    note: encodeURIComponent(note || ""),
    recipient: encodeURIComponent(rec),
    username: encodeURIComponent(rec),
    currency: "",
  });
}

/**
 * Human-readable copy fallback (when no deep-link handler is installed):
 * provides the amount, recipient, and a structured reference the sender can
 * type/paste into the bank app manually.
 */
export function buildCopyDetails(opts: {
  amount: number;
  recipient: string;
  note?: string;
  method: "KEKS Pay" | "Revolut";
}): string {
  return [
    `${opts.method} transfer`,
    `Amount: €${formatAmount(opts.amount)}`,
    `To: ${opts.recipient}`,
    opts.note ? `Reference: ${opts.note}` : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * HEP invoice field-extraction stubs. These use regex to pull the key figures
 * out of text from a real HEP Elektra bill (regular monthly slip or
 * final-account). Layouts vary, so the functions are best-effort: they return
 * partial candidates which the UI prefills into a fully-editable manual form.
 * An imperfect parse can never block data entry.
 *
 * Format notes (observed on a real monthly HEP invoice):
 *   - Meter section: "92094529 01.07.2026 31.07.2026 RVT R1 ... 1 649,51"
 *     (Potrošak / consumption is the last figure; RVT is VT, RNT is NT).
 *   - Supply section: "RVT Opskrba 01.07.2026 - 31.07.2026 222 kWh ..."
 *     and the overage lines "RVT Opskrba > 3.000 kWh ... 428 kWh".
 *   - Totals: "Ukupan iznos za električnu energiju ... 157,30"
 *             "UKUPAN IZNOS RAČUNA 193,60"
 */

export interface HepParseResult {
  periodStart?: string;
  periodEnd?: string;
  hepVtKwh?: number;
  hepNtKwh?: number;
  hepTotalSupply?: number;
  hepFees?: number;
  hepGrandTotal?: number;
  /** kWh already billed by HEP above the 3,000 threshold this period. */
  hepOverageKwh?: number;
  /** How likely the parse is to be trustworthy (0-1). */
  confidence: number;
}

/** Convert an OCR money string (e.g. "12,34", "1.234,56") to a number. */
function toNumber(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/[^\d.,]/g, "").trim();
  if (!cleaned) return undefined;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const commaIsDecimal = lastComma > lastDot;
  let normalized = cleaned;

  if (commaIsDecimal) {
    // European: "1.234,56" -> thousands dot, decimal comma
    normalized = cleaned.replace(/\./g, "").replace(/,/, ".");
  } else {
    normalized = cleaned.replace(/,/g, "");
  }

  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Normalize all whitespace to single spaces for predictable matching. */
function normalize(text: string): string {
  return text.replace(/\r?\n/g, "\n").replace(/[ \t]+/g, " ");
}

/** Parse "01.07.2026 - 31.07.2026" (any separator). */
function parsePeriod(text: string): {
  periodStart?: string;
  periodEnd?: string;
} {
  const m = text.match(
    /(\d{1,2})\.(\d{1,2})\.(\d{4})\.?\s*[-–—]\s*(\d{1,2})\.(\d{1,2})\.(\d{4})\.?/,
  );
  if (!m) return {};
  const pad = (n: string) => n.padStart(2, "0");
  return {
    periodStart: `${m[3]}-${pad(m[2]!)}-${pad(m[1]!)}`,
    periodEnd: `${m[6]}-${pad(m[5]!)}-${pad(m[4]!)}`,
  };
}

/**
 * Extract VT/NT total kWh from the meter-reading section. Rows look like:
 *   92094529 01.07.2026 31.07.2026 RVT R1 00008196,43 00008845,93 - očitanje 1 649,51
 *   RNT R2 00006348,24 00006736,69 - očitanje 1 388,45
 * where the final figure after "očitanje <const>" is the "Potrošak".
 */
function parseMeterConsumption(text: string): {
  vt?: number;
  nt?: number;
} {
  const lines = normalize(text).split("\n");
  let vt: number | undefined;
  let nt: number | undefined;
  for (const line of lines) {
    if (!/RVT|RNT/i.test(line)) continue;
    const m = line.match(
      /\b(RVT|RNT)\b[^\n]*?očit[^\n]*?\s+\d+\s+(\d+(?:[.,]\d+)?)/i,
    );
    if (!m) continue;
    const val = toNumber(m[2]);
    if (val === undefined) continue;
    if (m[1]!.toUpperCase() === "RVT") vt = val;
    if (m[1]!.toUpperCase() === "RNT") nt = val;
  }
  return { vt, nt };
}

/** Match a labelled monetary amount, e.g. "UKUPAN IZNOS RAČUNA 193,60". */
function parseLabelled(text: string, labels: string): number | undefined {
  const re = new RegExp(
    `\\b(${labels})\\b[^\\n]*?((?:EUR\\s*)?-?\\d{1,3}(?:[.,]\\d{3})*(?:[.,]\\d{1,2})|\\d+(?:[.,]\\d{1,2})?)`,
    "i",
  );
  const m = text.match(re);
  if (!m) return undefined;
  // Skip negative figures (e.g. "-4,13" popust) when looking for positive totals.
  const raw = m[2]!.replace("EUR", "").trim();
  const neg = /-\s*\d/.test(m[0]!.slice(-(m[2]!.length + 2)));
  const n = toNumber(raw);
  if (n === undefined) return undefined;
  return neg ? undefined : n;
}

/**
 * Best-effort extraction of HEP invoice fields from PDF-extracted text. Every
 * value is optional; callers must always show a manual-prefill form on top of
 * any candidates returned here.
 */
export function parseHepInvoice(rawText: string): HepParseResult {
  const text = normalize(rawText || "");

  const period = parsePeriod(text);
  const meter = parseMeterConsumption(text);

  // Overage already billed by HEP (supply lines "Opskrba > 3.000 kWh").
  const overageRe = /Opskrba >\s*3\.000\s*kWh[^\n]*?\s(\d+(?:[.,]\d+)?)\s*kWh/i;
  const overageMatch = text.match(overageRe);
  const hepOverageKwh = overageMatch ? toNumber(overageMatch[1]) : undefined;

  const grandTotal = parseLabelled(text, "ukupan iznos ra[cCčČ]una");
  const supply = parseLabelled(
    text,
    "ukupan iznos za elektri[cCčČ]nu energiju",
  );
  // Fees = any of the small regulated levies (renewable, solidarity). Prefer
  // the renewable-source incentive line, which is a pure fee.
  const fees =
    parseLabelled(text, "naknada za poticanje proizvodnje") ??
    parseLabelled(text, "solidarna naknada");

  const found = [
    period.periodStart,
    period.periodEnd,
    meter.vt,
    meter.nt,
    grandTotal,
    supply,
    fees,
  ].filter((v): v is string | number => v !== undefined).length;
  const confidence = found > 0 ? Math.min(1, found / 6) : 0;

  return {
    ...period,
    hepVtKwh: meter.vt,
    hepNtKwh: meter.nt,
    hepTotalSupply: supply,
    hepFees: fees,
    hepGrandTotal: grandTotal,
    hepOverageKwh,
    confidence,
  };
}

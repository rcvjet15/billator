import type { TariffConfig } from "@/lib/calc/types";

/**
 * Hand-curated HEP price baseline for "Kućanstvo" (household) tariffs.
 * There is no official public HEP price API, so this is a maintained template
 * the "Sync official prices" action loads into the DB. Update these when HEP
 * publishes new rates. Observed on a real 2026 HEP invoice (July 2026).
 */
export const PRICE_BASELINE: TariffConfig = {
  energyRateVt: 0.097189, // €/kWh, supply only, high tariff (VT)
  energyRateNt: 0.047688, // €/kWh, supply only, low tariff (NT)
  overageMultiplier: 1.35, // +35% above the semester threshold (× base)
  overageThresholdKwh: 3000, // rolling 6-month semi-annual threshold
  fixedFee: 0.98, // monthly supply fixed fee (€/month)
  gridFeeRate: 0.044446, // €/kWh, distribution (network) usage
  vatRate: 0.13, // PDV
};

/** Source override (from HEP sync tab), if the user provides a JSON URL. */
export async function fetchPricingFromUrl(
  sourceUrl: string,
): Promise<TariffConfig | null> {
  if (!sourceUrl) return null;
  try {
    const res = await fetch(sourceUrl, { method: "GET" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as Partial<TariffConfig>;
    // Validate the keys we care about.
    const out = { ...PRICE_BASELINE };
    const numeric = [
      "energyRateVt",
      "energyRateNt",
      "overageMultiplier",
      "overageThresholdKwh",
      "fixedFee",
      "gridFeeRate",
      "vatRate",
    ] as const;
    let any = false;
    for (const k of numeric) {
      const v = json[k];
      if (typeof v === "number" && Number.isFinite(v)) {
        (out as Record<string, number>)[k] = v;
        any = true;
      }
    }
    return any ? out : null;
  } catch {
    return null;
  }
}

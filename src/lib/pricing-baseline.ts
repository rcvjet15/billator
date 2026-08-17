import type { TariffConfig } from "@/lib/calc/types";

/** Models HEP publishes and their supply tariff figures (from the official
 *  HEP "Tarifne stavke (cijene)" household table). Values are the base
 *  (without PDV) rates per the 01-11-2025 tariff, matching the July 2026
 *  invoice. The energy rates here are the supply "Opskrba" rates; network
 *  tariffs are handled separately in gridFeeRate. */
export interface ModelRow {
  vt: number;
  nt: number;
  /** "Naknada za opskrbu" — monthly supply fixed fee. */
  opskrba: number;
}

/** Curated per-model supply tariffs observed from the HEP household table. */
export const TARIFF_MODELS: Record<string, ModelRow> = {
  Bijeli: { vt: 0.097189, nt: 0.047688, opskrba: 0.982 },
  Crveni: { vt: 0.097189, nt: 0.047688, opskrba: 0.982 },
  Plavi: { vt: 0.091324, nt: 0.047688, opskrba: 0.982 },
  Cmi: { vt: 0.037686, nt: 0.047688, opskrba: 0.982 },
};

export function listTariffModels(): string[] {
  return Object.keys(TARIFF_MODELS);
}

/** Full baseline config for a given model (falls back to Bijeli). */
export function baselineForModel(model?: string | null): TariffConfig {
  const row = TARIFF_MODELS[model ?? "Bijeli"] ?? TARIFF_MODELS.Bijeli;
  return {
    energyRateVt: row.vt,
    energyRateNt: row.nt,
    overageMultiplier: 1.35, // +35% above the semester threshold (× base)
    overageThresholdKwh: 3000, // rolling 6-month semi-annual threshold
    fixedFee: row.opskrba, // monthly supply fixed fee (€/month)
    gridFeeRate: 0.044446, // €/kWh, distribution (network) usage
    vatRate: 0.13, // PDV
  };
}

/** Default (used when no model is selected). */
export const PRICE_BASELINE: TariffConfig = baselineForModel("Bijeli");

/**
 * Resolve the tariff config for the selected model.
 * - If `sourceUrl` is provided and returns valid JSON, its numeric fields take
 *   precedence (lets you override via your own endpoint).
 * - Otherwise the embedded per-model baseline is used.
 */
export async function resolveTariffConfig(
  model: string,
  sourceUrl: string,
  useBaselineFallback: boolean,
): Promise<{ tariffs: TariffConfig; source: string }> {
  const base = baselineForModel(model);

  if (sourceUrl) {
    try {
      const fetched = await fetchPricingFromUrl(sourceUrl);
      if (fetched) {
        return { tariffs: { ...base, ...fetched }, source: sourceUrl };
      }
      if (!useBaselineFallback) {
        throw new Error("Could not fetch pricing from the configured URL.");
      }
    } catch (err) {
      if (!useBaselineFallback) throw err;
    }
  }

  return { tariffs: base, source: `baseline (${model})` };
}

/** Source override (from HEP sync tab), if the user provides a JSON URL. */
export async function fetchPricingFromUrl(
  sourceUrl: string,
): Promise<Partial<TariffConfig> | null> {
  if (!sourceUrl) return null;
  try {
    const res = await fetch(sourceUrl, { method: "GET" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as Partial<TariffConfig>;
    const out: Partial<TariffConfig> = {};
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

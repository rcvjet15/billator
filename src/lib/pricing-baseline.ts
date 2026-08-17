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

import type { TariffConfig } from "@/lib/calc/types";

/**
 * Full tariff default configuration. If the Postgres `tariff_config` row (or
 * env override) is absent, these values are used. Mirrors the reference
 * project's `default-config.ts` idiom.
 */
export const DEFAULT_CONFIG: TariffConfig = {
  energyRateVt: 0.115,
  energyRateNt: 0.065,
  overageMultiplier: 1.35,
  overageThresholdKwh: 3000,
  fixedFee: 6.5,
  gridFeeRate: 0.045,
  vatRate: 0.13,
};

/** Partial overrides loaded from the environment (optional, for quick tweaks). */
export function envTariffOverrides(): Partial<TariffConfig> {
  const o: Partial<TariffConfig> = {};
  const num = (k: string) =>
    process.env[k] !== undefined && process.env[k] !== ""
      ? Number(process.env[k])
      : undefined;
  const vt = num("TARIFF_ENERGY_RATE_VT");
  const nt = num("TARIFF_ENERGY_RATE_NT");
  const mult = num("TARIFF_OVERAGE_MULTIPLIER");
  const threshold = num("TARIFF_OVERAGE_THRESHOLD_KWH");
  const fixed = num("TARIFF_FIXED_FEE");
  const grid = num("TARIFF_GRID_FEE_RATE");
  const vat = num("TARIFF_VAT_RATE");
  if (vt !== undefined) o.energyRateVt = vt;
  if (nt !== undefined) o.energyRateNt = nt;
  if (mult !== undefined) o.overageMultiplier = mult;
  if (threshold !== undefined) o.overageThresholdKwh = threshold;
  if (fixed !== undefined) o.fixedFee = fixed;
  if (grid !== undefined) o.gridFeeRate = grid;
  if (vat !== undefined) o.vatRate = vat;
  return o;
}

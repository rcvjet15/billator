import type { TariffConfig } from "@/lib/calc/types";

/**
 * Full tariff default configuration (official HEP/HEP-Ops household rates per
 * the 01-11-2025 tariff, excluding PDV). If an override is absent these are
 * used. Mirrors the reference project's `default-config.ts` idiom.
 */
export const DEFAULT_CONFIG: TariffConfig = {
  energyRateVt: 0.097189,
  energyRateNt: 0.047688,
  energyRateJt: 0.091324,
  overageMultiplier: 1.35,
  overageThresholdKwh: 3000,
  fixedFee: 0.982,
  meteringFee: 1.983,
  transmissionRate: 0.021256,
  distributionRateVt: 0.044446,
  distributionRateNt: 0.020514,
  oieRate: 0.013239,
  vatRate: 0.13,
};

/** Partial overrides loaded from the environment (optional, for quick tweaks). */
export function envTariffOverrides(): Partial<TariffConfig> {
  const o: Partial<TariffConfig> = {};
  const num = (k: string) =>
    process.env[k] !== undefined && process.env[k] !== ""
      ? Number(process.env[k])
      : undefined;
  const numTo = (key: keyof TariffConfig, envKey: string) => {
    const v = num(envKey);
    if (v !== undefined) (o as Record<string, number>)[key] = v;
  };
  numTo("energyRateVt", "TARIFF_ENERGY_RATE_VT");
  numTo("energyRateNt", "TARIFF_ENERGY_RATE_NT");
  numTo("energyRateJt", "TARIFF_ENERGY_RATE_JT");
  numTo("overageMultiplier", "TARIFF_OVERAGE_MULTIPLIER");
  numTo("overageThresholdKwh", "TARIFF_OVERAGE_THRESHOLD_KWH");
  numTo("fixedFee", "TARIFF_FIXED_FEE");
  numTo("meteringFee", "TARIFF_METERING_FEE");
  numTo("transmissionRate", "TARIFF_TRANSMISSION_RATE");
  numTo("distributionRateVt", "TARIFF_DISTRIBUTION_RATE_VT");
  numTo("distributionRateNt", "TARIFF_DISTRIBUTION_RATE_NT");
  numTo("oieRate", "TARIFF_OIE_RATE");
  numTo("vatRate", "TARIFF_VAT_RATE");
  return o;
}

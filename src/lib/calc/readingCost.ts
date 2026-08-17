import type { Reading, TariffConfig } from "@/lib/calc/types";

/**
 * Estimate the upper floor's cost for a single reading, using base tariffs and
 * that reading's proportional share of total (HEP) consumption. This is an
 * estimate for the readings grid — it does NOT include the semester-level 35%
 * overage penalty (which is computed per semester block on /split).
 */
export function estimateReadingUpperCost(
  reading: Reading,
  tariff: TariffConfig,
): number {
  const upperKwh = reading.upperVtKwh + reading.upperNtKwh;
  const hepKwh = reading.hepVtKwh + reading.hepNtKwh;
  const share = hepKwh > 0 ? upperKwh / hepKwh : 0;

  const energy = reading.upperVtKwh * tariff.energyRateVt + reading.upperNtKwh * tariff.energyRateNt;
  const fixed = tariff.fixedFee * share;
  const grid = upperKwh * tariff.gridFeeRate;

  const vat = 1 + tariff.vatRate;
  return Math.round((energy + fixed + grid) * vat * 100) / 100;
}

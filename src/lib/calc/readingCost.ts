import type { Reading, TariffConfig } from "@/lib/calc/types";
import { cents } from "@/lib/calc/bill";

/**
 * Estimate the upper floor's cost for a single reading using the official
 * componentized tariff structure:
 *   - the upper floor's own VT/NT energy, plus
 *   - its own transmission, distribution and OIE (all per-kWh), plus
 *   - a proportional share of the flat supply + metering fees.
 *
 * Line items are rounded to cents; VAT is applied to the base subtotal.
 * This is an estimate for the readings grid — it does NOT include the
 * semester-level 35% overage penalty (computed per semester block on /split).
 */
export function estimateReadingUpperCost(
  reading: Reading,
  tariff: TariffConfig,
): number {
  const vt = reading.upperVtKwh;
  const nt = reading.upperNtKwh;
  const upperKwh = vt + nt;
  const hepKwh = reading.hepVtKwh + reading.hepNtKwh;
  const share = hepKwh > 0 ? upperKwh / hepKwh : 0;

  const energy = cents(vt * tariff.energyRateVt + nt * tariff.energyRateNt);
  const transmission = cents(upperKwh * tariff.transmissionRate);
  const distribution = cents(
    vt * tariff.distributionRateVt + nt * tariff.distributionRateNt,
  );
  const oie = cents(upperKwh * tariff.oieRate);
  const supply = cents(tariff.fixedFee * share);
  const metering = cents(tariff.meteringFee * share);

  const baseSubtotal = energy + transmission + distribution + oie + supply + metering;
  const vat = cents(baseSubtotal * tariff.vatRate);
  return cents(baseSubtotal + vat);
}

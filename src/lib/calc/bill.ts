import type { TariffConfig } from "@/lib/calc/types";

/** Round to 2 decimal places (cents). */
export function cents(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface BillLines {
  energyVt: number;
  energyNt: number;
  energyJt: number;
  energySubtotal: number;
  transmission: number;
  distributionVt: number;
  distributionNt: number;
  distributionSubtotal: number;
  networkSubtotal: number;
  oie: number;
  supply: number;
  metering: number;
  fixedSubtotal: number;
  baseSubtotal: number;
  vat: number;
  grossTotal: number;
}

export interface BillInput {
  vtKwh?: number;
  ntKwh?: number;
  /** Single-tariff usage (optional; used in place of VT/NT for JT meters). */
  jtKwh?: number;
}

/**
 * Compute the componentized HEP bill for a set of kWh volumes, applying the
 * official tariff structure. Per the billing rules, EVERY line item is
 * rounded to 2 decimal places individually before summing:
 *
 *   - Energy = VT_kWh*VT_rate, NT_kWh*NT_rate (and JT if provided)
 *   - Transmission on TOTAL kWh
 *   - Distribution on VT and NT kWh separately
 *   - OIE on TOTAL kWh
 *   - Fixed supply fee + metering (OMM) fee
 *   - Base Subtotal = sum of all rounded lines
 *   - VAT (PDV) = 13% of the rounded Base Subtotal, rounded to cents
 *   - Gross Total = Base Subtotal + VAT
 *
 * When `roundPerLine` is false, the raw line values are kept to full
 * precision and only the final gross is rounded (used to validate the
 * combined-rounding path in tests).
 */
export function calculateBill(
  input: BillInput,
  tariff: TariffConfig,
  roundPerLine = true,
): BillLines {
  const vt = input.vtKwh ?? 0;
  const nt = input.ntKwh ?? 0;
  const jt = input.jtKwh ?? 0;
  const total = vt + nt + jt;

  const round = (n: number) => (roundPerLine ? cents(n) : n);

  const energyVt = round(vt * tariff.energyRateVt);
  const energyNt = round(nt * tariff.energyRateNt);
  const energyJt = round(jt * tariff.energyRateJt);

  const transmission = round(total * tariff.transmissionRate);
  const distributionVt = round(vt * tariff.distributionRateVt);
  const distributionNt = round(nt * tariff.distributionRateNt);
  const oie = round(total * tariff.oieRate);
  const supply = round(tariff.fixedFee);
  const metering = round(tariff.meteringFee);

  const energySubtotal = energyVt + energyNt + energyJt;
  const distributionSubtotal = distributionVt + distributionNt;
  const networkSubtotal = transmission + distributionSubtotal;
  const fixedSubtotal = supply + metering;

  const baseSubtotal =
    energySubtotal + networkSubtotal + oie + fixedSubtotal;
  const vat = round(baseSubtotal * tariff.vatRate);
  const grossTotal = baseSubtotal + vat;

  return {
    energyVt,
    energyNt,
    energyJt,
    energySubtotal,
    transmission,
    distributionVt,
    distributionNt,
    distributionSubtotal,
    networkSubtotal,
    oie,
    supply,
    metering,
    fixedSubtotal,
    baseSubtotal,
    vat,
    grossTotal,
  };
}

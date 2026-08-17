import type { TariffConfig } from "@/lib/calc/types";

/** HEP/HEP-Ops default tariff schedule. Values are per-kWh / per-month.
 *  These are the built-in defaults; see `lib/default-config` for the
 *  full config service that merges env / DB overrides. */
export const DEFAULT_TARIFF_CONFIG: TariffConfig = {
  energyRateVt: 0.115, // EUR/kWh, high tariff (VT)
  energyRateNt: 0.065, // EUR/kWh, low tariff (NT)
  overageMultiplier: 1.35, // +35% above the semester threshold
  overageThresholdKwh: 3000, // rolling 6-month semi-annual threshold
  fixedFee: 6.5, // monthly fixed fee (EUR)
  gridFeeRate: 0.045, // EUR/kWh, contribution to the grid/network fee
  vatRate: 0.13, // VAT (PDV)
};

export function energyRate(tariff: TariffConfig, code: "vt" | "nt"): number {
  return code === "vt" ? tariff.energyRateVt : tariff.energyRateNt;
}

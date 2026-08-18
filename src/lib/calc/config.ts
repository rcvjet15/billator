import type { TariffConfig, TariffCode } from "@/lib/calc/types";

/** HEP/HEP-Ops default tariff schedule. Values are per-kWh / per-month.
 *  These are the built-in defaults; see `lib/default-config` for the
 *  full config service that merges env / DB overrides. */
export const DEFAULT_TARIFF_CONFIG: TariffConfig = {
  energyRateVt: 0.097189, // EUR/kWh, high tariff (VT) energy, excl. PDV
  energyRateNt: 0.047688, // EUR/kWh, low tariff (NT) energy, excl. PDV
  energyRateJt: 0.091324, // EUR/kWh, single tariff (JT) energy, excl. PDV
  overageMultiplier: 1.35, // +35% above the semester threshold
  overageThresholdKwh: 3000, // rolling 6-month semi-annual threshold
  fixedFee: 0.982, // monthly fixed supply fee (Opskrbna naknada), EUR
  meteringFee: 1.983, // monthly metering-point fee (Naknada za OMM), EUR
  transmissionRate: 0.021256, // EUR/kWh, transmission (Prijenos - HOPS), total kWh
  distributionRateVt: 0.044446, // EUR/kWh, distribution (HEP ODS) VT
  distributionRateNt: 0.020514, // EUR/kWh, distribution (HEP ODS) NT
  oieRate: 0.013239, // EUR/kWh, renewable energy fee (OIE), total kWh
  vatRate: 0.13, // VAT (PDV)
};

export function energyRate(tariff: TariffConfig, code: TariffCode): number {
  return code === "vt" ? tariff.energyRateVt : tariff.energyRateNt;
}

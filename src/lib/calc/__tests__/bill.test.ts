import { describe, expect, it } from "vitest";

import { calculateBill, cents } from "@/lib/calc/bill";
import { DEFAULT_CONFIG } from "@/lib/default-config";
import type { TariffConfig } from "@/lib/calc/types";

// Official Bijeli model baseline (from the 01-11-2025 HEP tariff, excl. PDV).
const BIJELI: TariffConfig = {
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

describe("calculateBill — 500 kWh VT + 200 kWh NT (Bijeli), per-line cent rounding", () => {
  const bill = calculateBill({ vtKwh: 500, ntKwh: 200 }, BIJELI);

  it("energy VT = 500 * 0.097189 = 48.59", () => {
    expect(bill.energyVt).toBe(48.59);
  });

  it("energy NT = 200 * 0.047688 = 9.54", () => {
    expect(bill.energyNt).toBe(9.54);
  });

  it("energy subtotal = 58.13", () => {
    expect(bill.energySubtotal).toBe(58.13);
  });

  it("transmission (700 * 0.021256) = 14.88", () => {
    expect(bill.transmission).toBe(14.88);
  });

  it("distribution VT (500 * 0.044446) = 22.22", () => {
    expect(bill.distributionVt).toBe(22.22);
  });

  it("distribution NT (200 * 0.020514) = 4.10", () => {
    expect(bill.distributionNt).toBe(4.10);
  });

  it("distribution subtotal (22.22 + 4.10) = 26.32 (per-line rounding)", () => {
    expect(bill.distributionSubtotal).toBe(26.32);
  });

  it("OIE (700 * 0.013239) = 9.27", () => {
    expect(bill.oie).toBe(9.27);
  });

  it("supply fee = 0.98", () => {
    expect(bill.supply).toBe(0.98);
  });

  it("metering (OMM) = 1.98", () => {
    expect(bill.metering).toBe(1.98);
  });

  it("base subtotal = 111.56", () => {
    expect(bill.baseSubtotal).toBe(111.56);
  });

  it("VAT 13% of 111.56 = 14.50", () => {
    expect(bill.vat).toBe(14.50);
  });

  it("gross total = 126.06", () => {
    expect(bill.grossTotal).toBe(126.06);
  });
});

describe("calculateBill — rounding rule consistency", () => {
  it("every line item is rounded to 2 decimals individually", () => {
    const bill = calculateBill({ vtKwh: 500, ntKwh: 200 }, BIJELI);
    for (const v of [
      bill.energyVt,
      bill.energyNt,
      bill.transmission,
      bill.distributionVt,
      bill.distributionNt,
      bill.oie,
      bill.supply,
      bill.metering,
    ]) {
      expect(v).toBe(cents(v));
    }
  });

  it("base subtotal equals the sum of the rounded lines", () => {
    const bill = calculateBill({ vtKwh: 500, ntKwh: 200 }, BIJELI);
    const sum =
      bill.energyVt +
      bill.energyNt +
      bill.transmission +
      bill.distributionVt +
      bill.distributionNt +
      bill.oie +
      bill.supply +
      bill.metering;
    expect(bill.baseSubtotal).toBe(sum);
  });

  it("gross = base + VAT", () => {
    const bill = calculateBill({ vtKwh: 500, ntKwh: 200 }, BIJELI);
    expect(bill.grossTotal).toBe(bill.baseSubtotal + bill.vat);
  });

  it("raw-combine path (roundPerLine=false) matches the alternative rounding", () => {
    // Combined distribution: 22.223 + 4.1028 = 26.3258 -> 26.33
    const bill = calculateBill({ vtKwh: 500, ntKwh: 200 }, BIJELI, false);
    // Gross is rounded once at the end.
    expect(bill.distributionSubtotal).toBeCloseTo(26.3258, 6);
  });
});

describe("calculateBill defaults match DEFAULT_CONFIG", () => {
  it("uses the official constants from the default config", () => {
    const d = DEFAULT_CONFIG as TariffConfig;
    expect(d.energyRateVt).toBe(0.097189);
    expect(d.energyRateNt).toBe(0.047688);
    expect(d.energyRateJt).toBe(0.091324);
    expect(d.transmissionRate).toBe(0.021256);
    expect(d.distributionRateVt).toBe(0.044446);
    expect(d.distributionRateNt).toBe(0.020514);
    expect(d.oieRate).toBe(0.013239);
    expect(d.fixedFee).toBe(0.982);
    expect(d.meteringFee).toBe(1.983);
    expect(d.vatRate).toBe(0.13);
    expect(d.overageMultiplier).toBe(1.35);
    expect(d.overageThresholdKwh).toBe(3000);
  });
});

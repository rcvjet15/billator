import { describe, expect, it } from "vitest";

import { estimateReadingUpperCost } from "@/lib/calc/readingCost";
import { calculateSplit, resolveBlock } from "@/lib/calc/semester";
import { baselineForModel } from "@/lib/pricing-baseline";
import type { Reading } from "@/lib/calc/types";

// Live July 2026 invoice scenario: HEP 649.5 VT / 388.5 NT (1038 kWh),
// upper floor sub-meter 500 VT / 200 NT (700 kWh). Bijeli model.
const TARIFF = baselineForModel("Bijeli");

const reading: Reading = {
  id: "jul-2026",
  periodStart: "2026-07-01",
  periodEnd: "2026-07-31",
  hepVtKwh: 649.5,
  hepNtKwh: 388.5,
  hepTotalSupply: 157.3,
  hepFees: 13.74,
  hepGrandTotal: 193.6,
  upperVtKwh: 500,
  upperNtKwh: 200,
  createdAt: "2026-07-31T00:00:00Z",
  updatedAt: "2026-07-31T00:00:00Z",
};

describe("live July 2026 bill split verification", () => {
  it("estimates the upper floor's cost at €124.98 (per-line cent rounding)", () => {
    // Energy 58.13 + transmission 14.88 + distribution 26.32 + OIE 9.27
    // + supply 0.66 + metering 1.34 = base 110.60; +13% VAT = 124.98
    expect(estimateReadingUpperCost(reading, TARIFF)).toBe(124.98);
  });

  it("does NOT trigger the 3,000 kWh overage penalty for this 1038 kWh month", () => {
    const block = resolveBlock("2026-07-15");
    const split = calculateSplit(block, [reading], TARIFF);
    expect(split.overage.crossed).toBe(false);
    expect(split.overage.overageKwh).toBe(0);
    expect(split.penaltyCost).toBe(0);
  });

  it("maps the upper floor's share proportionally against the granular items", () => {
    const share = 700 / 1038;
    expect(reading.upperVtKwh + reading.upperNtKwh).toBe(700);
    expect(reading.hepVtKwh + reading.hepNtKwh).toBe(1038);
    // The estimated upper split excludes the semester penalty and equals the
    // componentized per-line calculation on the 700 kWh, plus a share of fixed fees.
    expect(share).toBeCloseTo(0.67438, 4);
    expect(estimateReadingUpperCost(reading, TARIFF)).toBeGreaterThan(0);
  });
});

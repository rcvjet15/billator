import { describe, expect, it } from "vitest";

import { DEFAULT_TARIFF_CONFIG } from "@/lib/calc/config";
import { calculateSplit } from "@/lib/calc/semester";
import type { Reading } from "@/lib/calc/types";
import { winterBlockContaining } from "@/utils/dates";

const WINTER = winterBlockContaining(new Date("2026-01-15"));

function makeReading(partial: Partial<Reading>): Reading {
  return {
    id: partial.id ?? "r1",
    periodStart: partial.periodStart ?? "2025-12-01",
    periodEnd: partial.periodEnd ?? "2025-12-31",
    hepVtKwh: partial.hepVtKwh ?? 0,
    hepNtKwh: partial.hepNtKwh ?? 0,
    hepTotalSupply: partial.hepTotalSupply ?? 0,
    hepFees: partial.hepFees ?? 0,
    hepGrandTotal: partial.hepGrandTotal ?? 0,
    upperVtKwh: partial.upperVtKwh ?? 0,
    upperNtKwh: partial.upperNtKwh ?? 0,
    createdAt: partial.createdAt ?? "2026-01-01",
    updatedAt: partial.updatedAt ?? "2026-01-01",
  };
}

describe("running total & threshold crossing", () => {
  it("does not flag when total is below the threshold", () => {
    const r = makeReading({
      periodStart: "2025-12-01",
      periodEnd: "2025-12-31",
      hepVtKwh: 500,
      hepNtKwh: 0,
      upperVtKwh: 100,
    });
    const res = calculateSplit(WINTER, [r], DEFAULT_TARIFF_CONFIG);
    expect(res.overage.crossed).toBe(false);
    expect(res.overage.overageKwh).toBe(0);
    expect(res.runningTotalKwh).toBeCloseTo(500, 6);
  });

  it("flags at exactly the 3,000 kWh threshold with overage 0", () => {
    // Three 1000 kWh readings -> 3000 total (VT 500 + NT 500 each).
    const dates = [
      ["2025-11-01", "2025-11-30"],
      ["2025-12-01", "2025-12-31"],
      ["2026-01-01", "2026-01-31"],
    ] as const;
    const readings = dates.map(([s, e], i) =>
      makeReading({
        periodStart: s,
        periodEnd: e,
        hepVtKwh: 500,
        hepNtKwh: 500,
        id: `r${i + 1}`,
      }),
    );
    const res = calculateSplit(WINTER, readings, DEFAULT_TARIFF_CONFIG);
    expect(res.runningTotalKwh).toBeCloseTo(3000, 6);
    expect(res.overage.crossed).toBe(true);
    expect(res.overage.overageKwh).toBeCloseTo(0, 6);
  });

  it("reports overage above the 3,000 kWh threshold", () => {
    const dates = [
      ["2025-11-01", "2025-11-30"],
      ["2025-12-01", "2025-12-31"],
      ["2026-01-01", "2026-01-31"],
      ["2026-02-01", "2026-02-28"],
    ] as const;
    const readings = dates.map(([s, e], i) =>
      makeReading({
        periodStart: s,
        periodEnd: e,
        hepVtKwh: 800,
        hepNtKwh: 200,
        id: `r${i + 1}`,
      }),
    );
    // 4 x 1000 = 4000 -> overage 1000
    const res = calculateSplit(WINTER, readings, DEFAULT_TARIFF_CONFIG);
    expect(res.runningTotalKwh).toBeCloseTo(4000, 6);
    expect(res.overage.crossed).toBe(true);
    expect(res.overage.overageKwh).toBeCloseTo(1000, 6);
  });
});

describe("35% penalty on overage energy", () => {
  it("applies multiplier only to the overage portion (VT+NT proportional)", () => {
    const dates = [
      ["2025-11-01", "2025-11-30"],
      ["2025-12-01", "2025-12-31"],
      ["2026-01-01", "2026-01-31"],
      ["2026-02-01", "2026-02-28"],
    ] as const;
    const readings = dates.map(([s, e], i) =>
      makeReading({
        periodStart: s,
        periodEnd: e,
        hepVtKwh: 800,
        hepNtKwh: 200,
        id: `r${i + 1}`,
      }),
    );
    // 4000 total, 1000 overage. VT share 80% (800) NT share 20% (200).
    const tariff = { ...DEFAULT_TARIFF_CONFIG };
    const res = calculateSplit(WINTER, readings, tariff);

    const vtOverage = 800; // 1000 * (3200/4000) = 800
    const ntOverage = 200; // 1000 * (800/4000)  = 200
    const baseCostOverage =
      vtOverage * tariff.energyRateVt + ntOverage * tariff.energyRateNt;
    const penaltyCost = baseCostOverage * (tariff.overageMultiplier - 1);

    expect(res.penaltyCost).toBeCloseTo(penaltyCost, 1);
    // 35% surcharge is exactly (multiplier - 1) of the overage base cost.
    expect(res.energyCostAtPenalty).toBeCloseTo(
      res.energyCostAtBase + penaltyCost,
      1,
    );
  });

  it("produces zero penalty when under the threshold", () => {
    const r = makeReading({
      periodStart: "2025-12-01",
      periodEnd: "2025-12-31",
      hepVtKwh: 100,
      hepNtKwh: 50,
    });
    const res = calculateSplit(WINTER, [r], DEFAULT_TARIFF_CONFIG);
    expect(res.penaltyCost).toBe(0);
  });
});

describe("proportional penalty split (edge case #2)", () => {
  it("splits the penalty proportional to each floor's consumption share", () => {
    const tariff = { ...DEFAULT_TARIFF_CONFIG };
    // One block: HEP 4000 kWh total, upper reads 1000 of it -> ground 3000.
    const r = makeReading({
      periodStart: "2025-12-01",
      periodEnd: "2025-12-31",
      hepVtKwh: 3600,
      hepNtKwh: 400,
      upperVtKwh: 900,
      upperNtKwh: 100,
    });
    const res = calculateSplit(WINTER, [r], tariff);

    const groundShare = 3000 / 4000; // 0.75
    const upperShare = 1000 / 4000; // 0.25

    expect(res.ground.consumption.share).toBeCloseTo(groundShare, 6);
    expect(res.upper.consumption.share).toBeCloseTo(upperShare, 6);
    expect(res.ground.penaltyShare).toBeCloseTo(res.penaltyCost * groundShare, 1);
    expect(res.upper.penaltyShare).toBeCloseTo(res.penaltyCost * upperShare, 1);
    // Penalty is fully attributed to the floors.
    expect(res.ground.penaltyShare + res.upper.penaltyShare).toBeCloseTo(
      res.penaltyCost,
      1,
    );
  });

  it("reflects varying monthly usage via consumption share, not static 50/50", () => {
    const tariff = { ...DEFAULT_TARIFF_CONFIG };
    // 75/25 consumption (not 50/50) -> penalty must follow 75/25.
    const r = makeReading({
      periodStart: "2025-12-01",
      periodEnd: "2025-12-31",
      hepVtKwh: 4000,
      hepNtKwh: 0,
      upperVtKwh: 1000,
    });
    const res = calculateSplit(WINTER, [r], tariff);
    expect(res.ground.penaltyShare).toBeCloseTo(res.penaltyCost * 0.75, 1);
    expect(res.upper.penaltyShare).toBeCloseTo(res.penaltyCost * 0.25, 1);
  });

  it("assigns the full bill cost across the two floors", () => {
    const r = makeReading({
      periodStart: "2025-12-01",
      periodEnd: "2025-12-31",
      hepVtKwh: 3600,
      hepNtKwh: 400,
      upperVtKwh: 900,
      upperNtKwh: 100,
    });
    const res = calculateSplit(WINTER, [r], DEFAULT_TARIFF_CONFIG);
    expect(res.grandTotal).toBeCloseTo(
      res.ground.totalOwed + res.upper.totalOwed,
      6,
    );
    expect(res.grandTotal).toBeCloseTo(
      res.energyCostAtBase + res.penaltyCost + res.fixedCostTotal,
      6,
    );
  });
});

describe("split correctness", () => {
  it("ground floor = HEP total minus upper floor readings", () => {
    const r = makeReading({
      periodStart: "2025-12-01",
      periodEnd: "2025-12-31",
      hepVtKwh: 1000,
      hepNtKwh: 500,
      upperVtKwh: 200,
      upperNtKwh: 100,
    });
    const res = calculateSplit(WINTER, [r], DEFAULT_TARIFF_CONFIG);
    expect(res.ground.consumption.vtKwh).toBeCloseTo(800, 6);
    expect(res.ground.consumption.ntKwh).toBeCloseTo(400, 6);
    expect(res.upper.consumption.vtKwh).toBeCloseTo(200, 6);
    expect(res.upper.consumption.ntKwh).toBeCloseTo(100, 6);
  });

  it("handles a bill with only upper floor consumption (ground = 0)", () => {
    const r = makeReading({
      periodStart: "2025-12-01",
      periodEnd: "2025-12-31",
      hepVtKwh: 100,
      hepNtKwh: 0,
      upperVtKwh: 100,
    });
    const res = calculateSplit(WINTER, [r], DEFAULT_TARIFF_CONFIG);
    expect(res.ground.consumption.totalKwh).toBeCloseTo(0, 6);
    expect(res.upper.consumption.totalKwh).toBeCloseTo(100, 6);
  });
});

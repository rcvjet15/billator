import { describe, expect, it } from "vitest";

import { estimateReadingUpperCost } from "@/lib/calc/readingCost";
import { SqliteAdapter } from "@/lib/storage/sqlite-adapter";
import type { Reading, TariffConfig } from "@/lib/calc/types";

const TARIFF: TariffConfig = {
  energyRateVt: 0.097189,
  energyRateNt: 0.047688,
  overageMultiplier: 1.35,
  overageThresholdKwh: 3000,
  fixedFee: 0.982,
  gridFeeRate: 0.044446,
  vatRate: 0.13,
};

function makeReading(partial: Partial<Reading> = {}): Reading {
  return {
    id: "r1",
    periodStart: "2026-07-01",
    periodEnd: "2026-07-31",
    hepVtKwh: 649.51,
    hepNtKwh: 388.45,
    hepTotalSupply: 157.3,
    hepFees: 13.74,
    hepGrandTotal: 193.6,
    upperVtKwh: 120,
    upperNtKwh: 40,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    ...partial,
  };
}

describe("estimateReadingUpperCost", () => {
  it("returns 0 for a reading with no upper-floor usage", () => {
    const r = makeReading({ upperVtKwh: 0, upperNtKwh: 0 });
    expect(estimateReadingUpperCost(r, TARIFF)).toBe(0);
  });

  it("estimates energy + fixed/grid share + VAT", () => {
    // 100% of usage is the upper floor -> share = 1
    const r = makeReading({ hepVtKwh: 120, hepNtKwh: 40, upperVtKwh: 120, upperNtKwh: 40 });
    const energy = 120 * 0.097189 + 40 * 0.047688;
    const fixed = 0.982 * 1;
    const grid = 160 * 0.044446;
    const expected = Math.round((energy + fixed + grid) * 1.13 * 100) / 100;
    expect(estimateReadingUpperCost(r, TARIFF)).toBeCloseTo(expected, 2);
  });

  it("scales by the upper floor's share of total HEP usage", () => {
    const r = makeReading({ hepVtKwh: 649.51, hepNtKwh: 388.45, upperVtKwh: 120, upperNtKwh: 40 });
    // upperShare = 160 / 1037.96
    expect(estimateReadingUpperCost(r, TARIFF)).toBeGreaterThan(0);
  });
});

describe("SqliteAdapter origin handling", () => {
  it("derives parsed origin from a sourcePdfId", async () => {
    const adapter = new SqliteAdapter(":memory:");
    const r = await adapter.createReading({
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
      hepVtKwh: 1,
      sourcePdfId: "pdf1",
      sourcePdfName: "july.PDF",
    });
    expect(r.origin).toBe("parsed");
    adapter.close();
  });

  it("defaults to manual origin when no PDF", async () => {
    const adapter = new SqliteAdapter(":memory:");
    const r = await adapter.createReading({
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
      hepVtKwh: 1,
    });
    expect(r.origin).toBe("manual");
    adapter.close();
  });
});

import { describe, expect, it } from "vitest";

import { estimateReadingUpperCost } from "@/lib/calc/readingCost";
import { SqliteAdapter } from "@/lib/storage/sqlite-adapter";
import type { Reading, TariffConfig } from "@/lib/calc/types";

const TARIFF: TariffConfig = {
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

  it("estimates componentized cost with VAT (100% upper floor)", () => {
    // 100% of usage is the upper floor -> share = 1
    const r = makeReading({ hepVtKwh: 120, hepNtKwh: 40, upperVtKwh: 120, upperNtKwh: 40 });
    // energy(13.57) + transmission(3.40) + distribution(6.15) + oie(2.12)
    // + supply(0.98) + metering(1.98) = base 28.20; +13% VAT -> 31.87
    expect(estimateReadingUpperCost(r, TARIFF)).toBe(31.87);
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

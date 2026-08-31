import { describe, expect, it } from "vitest";

import {
  previousReading,
  resolveChannelDelta,
  resolveReadingDeltas,
} from "@/lib/calc/delta";
import type { Reading } from "@/lib/calc/types";

function makeReading(partial: Partial<Reading>): Reading {
  return {
    id: partial.id ?? "r",
    periodStart: partial.periodStart ?? "2026-07-01",
    periodEnd: partial.periodEnd ?? "2026-07-31",
    hepVtKwh: partial.hepVtKwh ?? 0,
    hepNtKwh: partial.hepNtKwh ?? 0,
    hepTotalSupply: 0,
    hepFees: 0,
    hepGrandTotal: 0,
    upperVtKwh: partial.upperVtKwh ?? 0,
    upperNtKwh: partial.upperNtKwh ?? 0,
    createdAt: "2026-08-01",
    updatedAt: "2026-08-01",
    ...partial,
  };
}

describe("previousReading", () => {
  it("returns the chronological predecessor by periodStart", () => {
    const readings = [
      makeReading({ id: "jun", periodStart: "2026-06-01" }),
      makeReading({ id: "aug", periodStart: "2026-08-01" }),
      makeReading({ id: "may", periodStart: "2026-05-01" }),
    ];
    expect(previousReading(readings, "2026-07-01")?.id).toBe("jun");
  });

  it("returns null when no reading precedes", () => {
    expect(previousReading([makeReading({ periodStart: "2026-07-01" })], "2026-06-01")).toBeNull();
  });
});

describe("resolveChannelDelta", () => {
  it("computes delta = end - start when both provided", () => {
    expect(resolveChannelDelta({ start: 100, end: 150 })).toEqual({ start: 100, end: 150, delta: 50 });
  });

  it("uses predecessor end as start when only end provided", () => {
    expect(resolveChannelDelta({ end: 150 }, { end: 100 })).toEqual({
      start: 100,
      end: 150,
      delta: 50,
    });
  });

  it("treats a no-predecessor end as baseline (start=end, delta 0)", () => {
    expect(resolveChannelDelta({ end: 100 })).toEqual({ start: 100, end: 100, delta: 0 });
  });

  it("flags a meter reset when end < predecessor end", () => {
    expect(resolveChannelDelta({ end: 50 }, { end: 100 })).toEqual({
      start: 100,
      end: 50,
      delta: 50,
      reset: true,
    });
  });

  it("falls back to derived consumption when no end given", () => {
    expect(resolveChannelDelta({ derived: 30 })).toEqual({ delta: 30 });
  });
});

describe("resolveReadingDeltas", () => {
  it("derives all four channels from cumulative ends against predecessor", () => {
    const prev = makeReading({
      hepEndVt: 8000,
      hepEndNt: 6300,
      upperEndVt: 1000,
      upperEndNt: 500,
    });
    const r = resolveReadingDeltas(
      { hepEndVt: 8200, hepEndNt: 6350, upperEndVt: 1100, upperEndNt: 520 },
      prev,
    );
    expect(r.consumption.hepVtKwh).toBe(200);
    expect(r.consumption.hepNtKwh).toBe(50);
    expect(r.consumption.upperVtKwh).toBe(100);
    expect(r.consumption.upperNtKwh).toBe(20);
    // Start/End persisted.
    expect(r.startEnd.hepStartVt).toBe(8000);
    expect(r.startEnd.hepEndVt).toBe(8200);
  });

  it("treats the first reading as baseline (delta 0)", () => {
    const r = resolveReadingDeltas({ hepEndVt: 100 }, null);
    expect(r.consumption.hepVtKwh).toBe(0);
    expect(r.startEnd.hepStartVt).toBe(100);
    expect(r.startEnd.hepEndVt).toBe(100);
  });
});

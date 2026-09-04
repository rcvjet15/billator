import { describe, expect, it } from "vitest";

import {
  previousReading,
  resolveChannelDelta,
  resolveReadingDeltas,
  recomputeConsumption,
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

  it("rounds the delta to 3 decimals", () => {
    // 150.1236 - 100 = 50.1236 -> rounds to 50.124
    expect(resolveChannelDelta({ start: 100, end: 150.1236 })).toEqual({
      start: 100,
      end: 150.1236,
      delta: 50.124,
    });
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

describe("recomputeConsumption", () => {
  it("walks chronologically and derives each channel delta from ends", () => {
    const readings = [
      // Out of order on purpose to exercise date-sorting.
      makeReading({ id: "feb", periodStart: "2026-02-01", hepEndVt: 8200, hepEndNt: 6350 }),
      makeReading({ id: "jan", periodStart: "2026-01-01", hepEndVt: 8000, hepEndNt: 6300 }),
    ];
    const out = recomputeConsumption(readings);
    // jan becomes baseline (delta 0), feb derives 8200-8000=200 / 50.
    const jan = out.find((o) => o.reading.periodStart === "2026-01-01")!;
    const feb = out.find((o) => o.reading.periodStart === "2026-02-01")!;
    expect(jan.hepVt.delta).toBe(0);
    expect(feb.hepVt.delta).toBe(200);
    expect(feb.hepNt.delta).toBe(50);
  });

  it("flags a channel whose stored consumption diverges (revised)", () => {
    // stored hepVtKwh=0 but recompute from ends yields 200
    const readings = [
      makeReading({ id: "jan", periodStart: "2026-01-01", hepEndVt: 8000, hepVtKwh: 8000 }),
      makeReading({ id: "feb", periodStart: "2026-02-01", hepEndVt: 8200, hepVtKwh: 0 }),
    ];
    const feb = recomputeConsumption(readings).find(
      (o) => o.reading.periodStart === "2026-02-01",
    )!;
    expect(feb.hepVt.revised).toBe(true);
    expect(feb.consumption.hepVtKwh).toBe(200);
  });

  it("does not invent counters for rows missing cumulative ends", () => {
    const readings = [
      makeReading({ id: "a", periodStart: "2026-01-01", hepVtKwh: 42 }),
    ];
    const out = recomputeConsumption(readings);
    expect(out[0].hepVt.missingCumulative).toBe(true);
    expect(out[0].consumption.hepVtKwh).toBe(0); // not overwritten from a counter
  });

  it("flags a meter reset when an end drops below its predecessor", () => {
    const readings = [
      makeReading({ id: "jan", periodStart: "2026-01-01", hepEndVt: 8000 }),
      makeReading({ id: "feb", periodStart: "2026-02-01", hepEndVt: 50 }),
    ];
    const feb = recomputeConsumption(readings).find(
      (o) => o.reading.periodStart === "2026-02-01",
    )!;
    expect(feb.hepVt.reset).toBe(true);
    expect(feb.hepVt.delta).toBe(50);
  });
});

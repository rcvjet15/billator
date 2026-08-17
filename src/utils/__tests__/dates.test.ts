import { describe, expect, it } from "vitest";

import {
  daysInclusive,
  prorateReading,
  semesterBlockContaining,
  semesterBlocksForRange,
} from "@/utils/dates";

describe("semester block membership", () => {
  it("assigns Oct 1 to the winter block", () => {
    // Oct 1 2026 falls in Winter 2026/2027 (Oct 1 2026 -> Mar 31 2027).
    const b = semesterBlockContaining(new Date(2026, 9, 1));
    expect(b.type).toBe("winter");
    expect(b.start.getMonth()).toBe(9); // Oct = 0-indexed 9
    expect(b.start.getFullYear()).toBe(2026);
    expect(b.end.getMonth()).toBe(2); // Mar = 0-indexed 2
    expect(b.end.getFullYear()).toBe(2027);
  });

  it("assigns Mar 31 to the winter block boundary", () => {
    const b = semesterBlockContaining(new Date(2026, 2, 31));
    expect(b.type).toBe("winter");
    expect(b.end.getFullYear()).toBe(2026);
  });

  it("assigns Apr 1 to the summer block", () => {
    const b = semesterBlockContaining(new Date(2026, 3, 1));
    expect(b.type).toBe("summer");
    expect(b.year).toBe(2026);
    expect(b.start.getMonth()).toBe(3);
    expect(b.end.getMonth()).toBe(8);
  });

  it("assigns Sep 30 to the summer block boundary", () => {
    const b = semesterBlockContaining(new Date(2026, 8, 30));
    expect(b.type).toBe("summer");
    expect(b.end.getMonth()).toBe(8);
  });
});

describe("daysInclusive", () => {
  it("counts a single day as 1", () => {
    expect(daysInclusive(new Date("2026-03-15"), new Date("2026-03-15"))).toBe(
      1,
    );
  });

  it("counts an inclusive range correctly", () => {
    // Mar 15 -> Mar 31 = 17 days
    expect(daysInclusive(new Date("2026-03-15"), new Date("2026-03-31"))).toBe(
      17,
    );
  });
});

describe("straddling-period proration (edge case #1)", () => {
  it("splits a Mar 15 - Apr 15 bill by days across winter and summer", () => {
    // Mar 15..Mar 31 = 17 days winter; Apr 1..Apr 15 = 15 days summer.
    // Total 32 inclusive days.
    const total = daysInclusive(new Date("2026-03-15"), new Date("2026-04-15"));
    expect(total).toBe(32);

    const p = prorateReading(
      "2026-03-15",
      "2026-04-15",
      320, // HEP VT
      80, // HEP NT
      100, // upper VT
      25, // upper NT
    );

    expect(p.winter.fraction).toBeCloseTo(17 / 32, 10);
    expect(p.summer.fraction).toBeCloseTo(15 / 32, 10);

    // Totals are preserved across both blocks, per tariff line.
    expect(p.winter.hepVtKwh + p.summer.hepVtKwh).toBeCloseTo(320, 6);
    expect(p.winter.hepNtKwh + p.summer.hepNtKwh).toBeCloseTo(80, 6);
    expect(p.winter.upperVtKwh + p.summer.upperVtKwh).toBeCloseTo(100, 6);
    expect(p.winter.upperNtKwh + p.summer.upperNtKwh).toBeCloseTo(25, 6);

    expect(p.winter.hepVtKwh).toBeCloseTo(320 * (17 / 32), 6);
    expect(p.summer.hepVtKwh).toBeCloseTo(320 * (15 / 32), 6);
  });

  it("keeps VT and NT proration independent", () => {
    const p = prorateReading("2026-03-15", "2026-04-15", 100, 900, 10, 990);
    expect(p.winter.hepNtKwh).toBeCloseTo(900 * (17 / 32), 6);
    expect(p.winter.hepVtKwh).toBeCloseTo(100 * (17 / 32), 6);
    expect(p.summer.hepNtKwh).toBeCloseTo(900 * (15 / 32), 6);
  });

  it("handles a summer->winter straddle (Sep 15 - Nov 15)", () => {
    const p = prorateReading("2026-09-15", "2026-11-15", 100, 100, 10, 10);
    // Sep 15..Sep 30 = 16 days summer; Oct 1..Nov 15 = 46 days winter.
    expect(p.summer.fraction).toBeCloseTo(16 / 62, 6);
    expect(p.winter.fraction).toBeCloseTo(46 / 62, 6);
    expect(p.summer.hepVtKwh + p.winter.hepVtKwh).toBeCloseTo(100, 6);
  });

  it("returns a full split (both sides zero) for an inside-block bill", () => {
    const p = prorateReading("2026-01-10", "2026-02-10", 40, 20, 5, 5);
    expect(p.winter.fraction).toBe(1);
    expect(p.summer.fraction).toBe(0);
    expect(p.winter.hepVtKwh).toBeCloseTo(40, 6);
    expect(p.summer.hepVtKwh).toBe(0);
  });
});

describe("semesterBlocksForRange", () => {
  it("returns both blocks for a straddling period", () => {
    const blocks = semesterBlocksForRange(
      new Date("2026-03-15"),
      new Date("2026-04-15"),
    );
    expect(blocks.map((b) => b.type).sort()).toEqual(["summer", "winter"]);
  });

  it("returns a single block for a contained period", () => {
    const blocks = semesterBlocksForRange(new Date("2026-06-01"), new Date("2026-06-30"));
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.type).toBe("summer");
  });
});

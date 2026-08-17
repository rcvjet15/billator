import { describe, expect, it } from "vitest";

import { groupReadings, semesterKey } from "@/lib/calc/groupReadings";
import type { Reading } from "@/lib/calc/types";

function makeReading(start: string, end: string, hep = 100, upper = 10): Reading {
  return {
    id: start,
    periodStart: start,
    periodEnd: end,
    hepVtKwh: hep,
    hepNtKwh: hep / 4,
    hepTotalSupply: 10,
    hepFees: 2,
    hepGrandTotal: hep / 2,
    upperVtKwh: upper,
    upperNtKwh: upper / 4,
    createdAt: start,
    updatedAt: start,
    upperCost: 5,
  };
}

describe("groupReadings", () => {
  it("groups by month and sums totals", () => {
    const readings = [
      makeReading("2026-07-01", "2026-07-31", 100, 10),
      makeReading("2026-07-05", "2026-07-31", 200, 20),
      makeReading("2026-08-01", "2026-08-31", 150, 15),
    ];
    const groups = groupReadings(readings, "month");
    expect(groups).toHaveLength(2);
    const july = groups.find((g) => g.key === "2026-07")!;
    expect(july.count).toBe(2);
    expect(july.hepVtKwh + july.hepNtKwh).toBeCloseTo(375, 6);
    expect(july.upperCost).toBeCloseTo(10, 6);
  });

  it("groups by year", () => {
    const groups = groupReadings(
      [makeReading("2026-07-01", "2026-07-31"), makeReading("2025-12-01", "2025-12-31")],
      "year",
    );
    expect(groups.map((g) => g.key).sort()).toEqual(["2025", "2026"]);
  });

  it("labels semesters by the cycle boundaries", () => {
    const cycle = {
      winterStartDay: 1,
      winterStartMonth: 10,
      winterEndDay: 31,
      winterEndMonth: 3,
      summerStartDay: 1,
      summerStartMonth: 4,
      summerEndDay: 30,
      summerEndMonth: 9,
    };
    expect(semesterKey("2026-07-01", cycle).label).toBe("Summer 2026");
    expect(semesterKey("2026-10-15", cycle).label).toBe("Winter 2026/27");
    expect(semesterKey("2026-12-01", cycle).label).toBe("Winter 2026/27");
    expect(semesterKey("2026-01-15", cycle).label).toBe("Winter 2025/26");
  });
});

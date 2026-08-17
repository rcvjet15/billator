import type { Reading } from "@/lib/calc/types";

export type GroupBy = "month" | "year" | "semester";

export interface ReadingTotals {
  count: number;
  hepVtKwh: number;
  hepNtKwh: number;
  upperVtKwh: number;
  upperNtKwh: number;
  hepTotal: number;
  upperCost: number;
}

export interface ReadingGroup extends ReadingTotals {
  key: string;
  label: string;
  start: string;
}

/** Month key (yyyy-mm) and label from an ISO date. */
function monthKey(dateStr: string): { key: string; label: string } {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return { key: dateStr, label: dateStr };
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return {
    key: `${yyyy}-${mm}`,
    label: `${String(d.getDate()).padStart(2, "0")}.${mm}.${yyyy}`,
  };
}

function yearKey(dateStr: string): { key: string; label: string } {
  const d = new Date(dateStr);
  return {
    key: String(d.getFullYear()),
    label: String(d.getFullYear()),
  };
}

/**
 * Build the semester label containing the reading's period-start date, using
 * the configured cycle boundaries. Winter runs (winterStartMonth/..Day) →
 * (winterEndMonth/..winterEndDay) across a year boundary; summer runs
 * (summerStart..) → (summerEnd..). Falls back to calendar-year grouping if the
 * cycle settings are invalid.
 */
export function semesterKey(
  dateStr: string,
  cycle: {
    winterStartDay: number;
    winterStartMonth: number;
    winterEndDay: number;
    winterEndMonth: number;
    summerStartDay: number;
    summerStartMonth: number;
    summerEndDay: number;
    summerEndMonth: number;
  },
): { key: string; label: string } {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return { key: dateStr, label: dateStr };
  const year = d.getFullYear();
  const month = d.getMonth() + 1;

  // Winter includes months >= winterStartMonth (fall/winter) up to the
  // following year's winterEndMonth. Build label like "Winter 2025/26" or
  // "Summer 2026".
  const inFallWinter = month >= cycle.winterStartMonth;
  const inWinterTail = month <= cycle.winterEndMonth;
  if (inFallWinter || inWinterTail) {
    const endYear = inFallWinter ? year + 1 : year;
    return {
      key: `winter-${endYear}`,
      label: `Winter ${endYear - 1}/${String(endYear).slice(2)}`,
    };
  }
  return { key: `summer-${year}`, label: `Summer ${year}` };
}

function startOfReading(s: string): string | null {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** Group a list of readings by the given granularity, with totals per group. */
export function groupReadings(
  readings: Reading[],
  by: GroupBy,
  cycle?: Parameters<typeof semesterKey>[1],
  fallback: string = "",
): ReadingGroup[] {
  const groups = new Map<string, ReadingGroup>();
  for (const r of readings) {
    const start = startOfReading(r.periodStart) ?? fallback;
    let key = "";
    let label = "";
    if (by === "month") {
      const m = monthKey(start);
      key = m.key;
      label = m.label;
    } else if (by === "year") {
      const y = yearKey(start);
      key = y.key;
      label = y.label;
    } else {
      const s = cycle
        ? semesterKey(start, cycle)
        : { key: start.slice(0, 7), label: start.slice(0, 7) };
      key = s.key;
      label = s.label;
    }
    if (!key) continue;

    const g = groups.get(key) ?? {
      key,
      label,
      start,
      count: 0,
      hepVtKwh: 0,
      hepNtKwh: 0,
      upperVtKwh: 0,
      upperNtKwh: 0,
      hepTotal: 0,
      upperCost: 0,
    };
    g.count += 1;
    g.hepVtKwh += r.hepVtKwh;
    g.hepNtKwh += r.hepNtKwh;
    g.upperVtKwh += r.upperVtKwh;
    g.upperNtKwh += r.upperNtKwh;
    g.hepTotal += r.hepGrandTotal;
    g.upperCost += r.upperCost ?? 0;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.key.localeCompare(a.key));
}

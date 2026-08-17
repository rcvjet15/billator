import type { ProratedSplit, SemesterBlock, SemesterType } from "@/lib/calc/types";

const WINTER_START_MONTH = 10;
const WINTER_START_DAY = 1;
const WINTER_END_MONTH = 3;
const WINTER_END_DAY = 31;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * The number of whole days in [start, end] inclusive.
 */
export function daysInclusive(start: Date, end: Date): number {
  const ms = startOfDay(end).getTime() - startOfDay(start).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

/**
 * Build the winter semester block that `date` falls into.
 * Winter runs Oct 1 (of year-1) through Mar 31 (of `year`).
 */
export function winterBlockContaining(date: Date): SemesterBlock {
  let endYear = date.getFullYear();
  if (date.getMonth() + 1 >= WINTER_START_MONTH) {
    endYear += 1;
  }
  return {
    type: "winter",
    year: endYear,
    start: new Date(endYear - 1, WINTER_START_MONTH - 1, WINTER_START_DAY),
    end: new Date(endYear, WINTER_END_MONTH - 1, WINTER_END_DAY),
    label: `Winter ${endYear - 1}/${endYear}`,
  };
}

/**
 * Build the summer semester block that `date` falls into.
 * Summer runs Apr 1 through Sep 30 of `year`.
 */
export function summerBlockContaining(date: Date): SemesterBlock {
  let year = date.getFullYear();
  const month = date.getMonth() + 1;
  // A date in Jan-Mar belongs to the previous summer (Apr-Sep of year-1).
  if (month < 4) {
    year -= 1;
  }
  return {
    type: "summer",
    year,
    start: new Date(year, 3, 1),
    end: new Date(year, 8, 30),
    label: `Summer ${year}`,
  };
}

/** The semester block containing `date` (winter or summer), by date. */
export function semesterBlockContaining(date: Date): SemesterBlock {
  const month = date.getMonth() + 1;
  if (month >= WINTER_START_MONTH || month <= WINTER_END_MONTH) {
    return winterBlockContaining(date);
  }
  return summerBlockContaining(date);
}

/** How many days of [start,end] fall inside `block`. */
function overlapDays(
  block: SemesterBlock,
  start: Date,
  end: Date,
): number {
  const lo = new Date(
    Math.max(block.start.getTime(), startOfDay(start).getTime()),
  );
  const hi = new Date(
    Math.min(block.end.getTime(), startOfDay(end).getTime()),
  );
  if (hi < lo) return 0;
  return daysInclusive(lo, hi);
}

/**
 * The ordered list of semester blocks that a period [start, end] touches,
 * walking day-by-day to collect every distinct block (handles both
 * winter->summer and summer->winter straddles, and never over-iterates).
 */
export function semesterBlocksForRange(
  start: Date,
  end: Date,
): SemesterBlock[] {
  const blocks: SemesterBlock[] = [];
  const seen = new Set<string>();
  // A bill never spans more than a couple of blocks; a bounded walk is safe.
  let cursor = startOfDay(start);
  let guard = 0;
  while (cursor <= startOfDay(end) && guard < 800) {
    const block = semesterBlockContaining(cursor);
    const key = `${block.type}:${block.year}`;
    if (!seen.has(key)) {
      seen.add(key);
      blocks.push(block);
    }
    cursor = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate() + 1,
    );
    guard += 1;
  }
  return blocks;
}

/**
 * Proportionally prorate a reading's kWh across the semester blocks it
 * touches, preserving total kWh for VT and NT independently.
 *
 * A reading Mar 15 -> Apr 15 is split by days: the winter portion (Oct 1 -
 * Mar 31) vs the summer portion (Apr 1 - Sep 30). Each tariff line (VT/NT)
 * is scaled by the same day-fraction so nothing is lost or over-counted.
 */
export function prorateReading(
  periodStart: string,
  periodEnd: string,
  hepVtKwh: number,
  hepNtKwh: number,
  upperVtKwh: number,
  upperNtKwh: number,
): ProratedSplit {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  const totalDays = daysInclusive(start, end);

  const blocks = semesterBlocksForRange(start, end);

  const side = (
    block: SemesterBlock | undefined,
  ): ProratedSplit["winter"] => {
    const fraction = block
      ? totalDays > 0
        ? overlapDays(block, start, end) / totalDays
        : 0
      : 0;
    return {
      fraction,
      hepVtKwh: hepVtKwh * fraction,
      hepNtKwh: hepNtKwh * fraction,
      upperVtKwh: upperVtKwh * fraction,
      upperNtKwh: upperNtKwh * fraction,
    };
  };

  const winter = blocks.find((b) => b.type === "winter");
  const summer = blocks.find((b) => b.type === "summer");

  return {
    periodStart,
    periodEnd,
    winter: side(winter),
    summer: side(summer),
  };
}

export type { SemesterType };

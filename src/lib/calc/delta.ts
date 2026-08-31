import type { Reading } from "@/lib/calc/types";

export type MeterChannel = "vt" | "nt";
export type MeterOwner = "hep" | "upper";

export interface ChannelInput {
  start?: number;
  end?: number;
  derived?: number;
}

/**
 * The chronological predecessor of a reading: the one with the largest
 * periodStart strictly before the current one. Independent of channel/source.
 */
export function previousReading(
  readings: Reading[],
  periodStart: string,
): Reading | null {
  let best: Reading | null = null;
  for (const r of readings) {
    if (r.periodStart >= periodStart) continue;
    if (!best || r.periodStart > best.periodStart) best = r;
  }
  return best;
}

/**
 * Resolve a single channel's cumulative start/end and derived delta.
 *
 * - If both start and end are present: delta = end - start (with reset/error
 *   detection when end < start).
 * - If only end is present and a previous cumulative end exists: start = prev,
 *   delta = end - prev.
 * - If only end is present with no predecessor: treated as a baseline
 *   (start = end, delta = 0) so it becomes the new starting point.
 * - Otherwise fall back to the provided derived consumption.
 */
export function resolveChannelDelta(
  input: Partial<{ start?: number; end?: number; derived?: number }>,
  prev?: { end?: number },
): { start?: number; end?: number; delta: number; reset?: boolean } {
  const { start, end } = input;
  const prevEnd = prev?.end;

  if (start !== undefined && end !== undefined) {
    // Both provided: delta = end - start.
    if (end < start) {
      return { start, end, delta: end, reset: true };
    }
    return { start, end, delta: end - start };
  }

  if (end !== undefined) {
    if (prevEnd !== undefined && end >= prevEnd) {
      // Use predecessor's end as the start.
      return { start: prevEnd, end, delta: end - prevEnd };
    }
    if (prevEnd !== undefined && end < prevEnd) {
      // Meter reset/wrap: treat end as the new baseline in place.
      return { start: prevEnd, end, delta: end, reset: true };
    }
    // No predecessor (baseline): record end, start = end, no consumption.
    return { start: end, end, delta: 0 };
  }

  // No end provided: fall back to derived consumption if given.
  return { start, end, delta: input.derived ?? 0 };
}

export interface DeltasResult {
  hepVt: { start?: number; end?: number; delta: number; reset?: boolean };
  hepNt: { start?: number; end?: number; delta: number; reset?: boolean };
  upperVt: { start?: number; end?: number; delta: number; reset?: boolean };
  upperNt: { start?: number; end?: number; delta: number; reset?: boolean };
}

export type CumulativeInput = Partial<
  Pick<
    Reading,
    | "hepStartVt"
    | "hepEndVt"
    | "hepStartNt"
    | "hepEndNt"
    | "upperStartVt"
    | "upperEndVt"
    | "upperStartNt"
    | "upperEndNt"
  > & {
    hepVtKwh?: number;
    hepNtKwh?: number;
    upperVtKwh?: number;
    upperNtKwh?: number;
  }
>;

/**
 * Compute deltas for all four channels from an input against the previous
 * reading. Returns the derived consumption values (hepVtKwh, etc.) and the
 * cumulative start/end to persist.
 */
export function resolveReadingDeltas(
  input: CumulativeInput,
  prev: Reading | null,
): {
  deltas: DeltasResult;
  consumption: {
    hepVtKwh: number;
    hepNtKwh: number;
    upperVtKwh: number;
    upperNtKwh: number;
  };
  startEnd: Partial<Reading>;
} {
  const hepVt = resolveChannelDelta(
    { start: input.hepStartVt, end: input.hepEndVt, derived: input.hepVtKwh },
    { end: prev?.hepEndVt },
  );
  const hepNt = resolveChannelDelta(
    { start: input.hepStartNt, end: input.hepEndNt, derived: input.hepNtKwh },
    { end: prev?.hepEndNt },
  );
  const upperVt = resolveChannelDelta(
    { start: input.upperStartVt, end: input.upperEndVt, derived: input.upperVtKwh },
    { end: prev?.upperEndVt },
  );
  const upperNt = resolveChannelDelta(
    { start: input.upperStartNt, end: input.upperEndNt, derived: input.upperNtKwh },
    { end: prev?.upperEndNt },
  );

  const startEnd: Partial<Reading> = {};
  if (hepVt.start !== undefined) startEnd.hepStartVt = hepVt.start;
  if (hepVt.end !== undefined) startEnd.hepEndVt = hepVt.end;
  if (hepNt.start !== undefined) startEnd.hepStartNt = hepNt.start;
  if (hepNt.end !== undefined) startEnd.hepEndNt = hepNt.end;
  if (upperVt.start !== undefined) startEnd.upperStartVt = upperVt.start;
  if (upperVt.end !== undefined) startEnd.upperEndVt = upperVt.end;
  if (upperNt.start !== undefined) startEnd.upperStartNt = upperNt.start;
  if (upperNt.end !== undefined) startEnd.upperEndNt = upperNt.end;

  return {
    deltas: { hepVt, hepNt, upperVt, upperNt },
    consumption: {
      hepVtKwh: hepVt.delta,
      hepNtKwh: hepNt.delta,
      upperVtKwh: upperVt.delta,
      upperNtKwh: upperNt.delta,
    },
    startEnd,
  };
}

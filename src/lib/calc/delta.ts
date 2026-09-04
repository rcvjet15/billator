import type { Reading } from "@/lib/calc/types";

/** Round a kWh delta to 3 decimals. */
function round3(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

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
      return { start, end, delta: round3(end), reset: true };
    }
    return { start, end, delta: round3(end - start) };
  }

  if (end !== undefined) {
    if (prevEnd !== undefined && end >= prevEnd) {
      // Use predecessor's end as the start.
      return { start: prevEnd, end, delta: round3(end - prevEnd) };
    }
    if (prevEnd !== undefined && end < prevEnd) {
      // Meter reset/wrap: treat end as the new baseline in place.
      return { start: prevEnd, end, delta: round3(end), reset: true };
    }
    // No predecessor (baseline): record end, start = end, no consumption.
    return { start: end, end, delta: 0 };
  }

  // No end provided: fall back to derived consumption if given.
  return { start, end, delta: round3(input.derived ?? 0) };
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

/** A single recomputed channel result for reporting gaps/mismatches. */
export interface RecomputeChannel {
  /** Cumulative counter end found on the reading for this channel. */
  end?: number;
  /** Re-derived monthly consumption (end - predecessor end). */
  delta: number;
  /** Whether a meter reset/wrap was detected (end < predecessor end). */
  reset: boolean;
  /** True when the stored consumption differed from the re-derived value. */
  revised: boolean;
  /** True when no cumulative counter was found at all (only derived kWh). */
  missingCumulative: boolean;
}

export interface ReadingRecompute {
  reading: Reading;
  /** New consumption values to persist (deltas as of this recompute). */
  consumption: {
    hepVtKwh: number;
    hepNtKwh: number;
    upperVtKwh: number;
    upperNtKwh: number;
  };
  hepVt: RecomputeChannel;
  hepNt: RecomputeChannel;
  upperVt: RecomputeChannel;
  upperNt: RecomputeChannel;
  /** Date-sorted sequence position this reading occupies. */
  changed: boolean;
}

interface RecomputeChannelMeta {
  end?: number;
  prevEnd?: number;
  derivedConsumption?: number;
  reset?: boolean;
  /** Set when no cumulative counter end exists on the reading. */
  missingCumulative?: boolean;
}

function recomputeChannelMeta(
  end?: number,
  prevEnd?: number,
  missingCumulative = end === undefined,
): RecomputeChannelMeta {
  const meta: RecomputeChannelMeta = {
    prevEnd,
    end,
    missingCumulative,
  };
  if (missingCumulative || end === undefined) return meta;
  meta.reset = prevEnd !== undefined && end < prevEnd;
  meta.derivedConsumption =
    prevEnd !== undefined ? (end < prevEnd ? round3(end) : round3(end - prevEnd)) : 0;
  return meta;
}

/**
 * Recompute every reading's monthly consumption from its cumulative counter
 * ends (`hep*EndVt/Nt`, `upper*EndVt/Nt`), walking in chronological order so
 * each reading's predecessor is the previously processed one.
 *
 * This is the "single source of truth" invariant: counters are authoritative
 * and `*VtKwh/*NtKwh` are always derived. Readings that lack cumulative ends
 * (only invoice-derived kWh) are reported as `missingCumulative` and left
 * untouched so we never invent counters.
 */
export function recomputeConsumption(readings: Reading[]): ReadingRecompute[] {
  const sorted = [...readings].sort((a, b) => a.periodStart.localeCompare(b.periodStart));

  // Previous cumulative end per channel, carried forward independently.
  let prevEndHepVt: number | undefined;
  let prevEndHepNt: number | undefined;
  let prevEndUpperVt: number | undefined;
  let prevEndUpperNt: number | undefined;

  const out: ReadingRecompute[] = [];

  for (const reading of sorted) {
    // Recompute each channel only when a cumulative end is present; otherwise
    // report missingCumulative and leave existing consumption untouched.
    const metaHepVt = recomputeChannelMeta(
      reading.hepEndVt,
      prevEndHepVt,
      reading.hepEndVt === undefined,
    );
    const metaHepNt = recomputeChannelMeta(
      reading.hepEndNt,
      prevEndHepNt,
      reading.hepEndNt === undefined,
    );
    const metaUpperVt = recomputeChannelMeta(
      reading.upperEndVt,
      prevEndUpperVt,
      reading.upperEndVt === undefined,
    );
    const metaUpperNt = recomputeChannelMeta(
      reading.upperEndNt,
      prevEndUpperNt,
      reading.upperEndNt === undefined,
    );

    const channel = (
      meta: RecomputeChannelMeta,
      readingChannelConsumption: number,
    ): RecomputeChannel => ({
      end: meta.end,
      delta: meta.derivedConsumption ?? 0,
      reset: Boolean(meta.reset),
      revised:
        !meta.missingCumulative &&
        meta.derivedConsumption !== undefined &&
        Math.abs(meta.derivedConsumption - readingChannelConsumption) > 0.0005,
      missingCumulative: Boolean(meta.missingCumulative),
    });

    const hepVt = channel(metaHepVt, reading.hepVtKwh);
    const hepNt = channel(metaHepNt, reading.hepNtKwh);
    const upperVt = channel(metaUpperVt, reading.upperVtKwh);
    const upperNt = channel(metaUpperNt, reading.upperNtKwh);

    const changed =
      hepVt.revised || hepNt.revised || upperVt.revised || upperNt.revised;

    out.push({
      reading,
      consumption: {
        hepVtKwh: hepVt.delta,
        hepNtKwh: hepNt.delta,
        upperVtKwh: upperVt.delta,
        upperNtKwh: upperNt.delta,
      },
      hepVt,
      hepNt,
      upperVt,
      upperNt,
      changed,
    });

    // Advance the per-channel predecessor end for the next reading.
    if (reading.hepEndVt !== undefined) prevEndHepVt = reading.hepEndVt;
    if (reading.hepEndNt !== undefined) prevEndHepNt = reading.hepEndNt;
    if (reading.upperEndVt !== undefined) prevEndUpperVt = reading.upperEndVt;
    if (reading.upperEndNt !== undefined) prevEndUpperNt = reading.upperEndNt;
  }

  return out;
}

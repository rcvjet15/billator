import { NextRequest, NextResponse } from "next/server";

import { previousReading, resolveReadingDeltas } from "@/lib/calc/delta";
import type { Reading } from "@/lib/calc/types";
import { StorageService } from "@/lib/storage-service";

type Params = { id: string };

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<Params> },
) {
  const { id } = await ctx.params;
  try {
    const storage = StorageService.getInstance();
    const reading = await storage.getReading(id);
    if (!reading) {
      return NextResponse.json({ error: "Reading not found." }, { status: 404 });
    }
    return NextResponse.json({ reading });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to get reading." },
      { status: 500 },
    );
  }
}

function toPartial(body: Record<string, unknown>): Partial<Reading> {
  const input: Partial<Reading> = {};
  const numericKeys = [
    "periodStart",
    "periodEnd",
    "hepVtKwh",
    "hepNtKwh",
    "hepTotalSupply",
    "hepFees",
    "hepGrandTotal",
    "upperVtKwh",
    "upperNtKwh",
    "hepStartVt",
    "hepEndVt",
    "hepStartNt",
    "hepEndNt",
    "upperStartVt",
    "upperEndVt",
    "upperStartNt",
    "upperEndNt",
  ] as const;
  for (const key of numericKeys) {
    const v = body[key];
    if (v === undefined) continue;
    if (typeof v === "number") (input as Record<string, unknown>)[key] = v;
    if (typeof v === "string") {
      const n = Number(v);
      (input as Record<string, unknown>)[key] = Number.isFinite(n) ? n : v;
    }
  }
  return input;
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<Params> },
) {
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const storage = StorageService.getInstance();
    const partial = toPartial(body);
    const all = await storage.listReadings();
    const current = all.find((r) => r.id === id);

    // Determine the predecessor among the other readings (exclude this one).
    const others = all.filter((r) => r.id !== id);
    const prev = current ? previousReading(others, current.periodStart) : null;

    // Merge the requested cumulative changes over current to recompute deltas.
    const mergedCumulative: Partial<Reading> = {
      ...current,
      ...partial,
    };
    const { consumption, startEnd } = resolveReadingDeltas(mergedCumulative, prev);

    // If the user edited a channel's monthly consumption directly (not via
    // cumulative counters), honour that value. Only derive-from-counter the
    // channels that were NOT provided so manual kWh (e.g. upper floor entered
    // as consumption) is never zeroed by cumulative baseline math.
    const had = (k: keyof Reading) => body[k] !== undefined;
    const reading = await storage.updateReading(id, {
      ...partial,
      ...startEnd,
      hepVtKwh: had("hepVtKwh") ? (partial.hepVtKwh ?? 0) : consumption.hepVtKwh,
      hepNtKwh: had("hepNtKwh") ? (partial.hepNtKwh ?? 0) : consumption.hepNtKwh,
      upperVtKwh: had("upperVtKwh") ? (partial.upperVtKwh ?? 0) : consumption.upperVtKwh,
      upperNtKwh: had("upperNtKwh") ? (partial.upperNtKwh ?? 0) : consumption.upperNtKwh,
    });
    if (!reading) {
      return NextResponse.json({ error: "Reading not found." }, { status: 404 });
    }
    return NextResponse.json({ reading });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to update reading." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<Params> },
) {
  const { id } = await ctx.params;
  try {
    const storage = StorageService.getInstance();
    const deleted = await storage.deleteReading(id);
    if (!deleted) {
      return NextResponse.json({ error: "Reading not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to delete reading." },
      { status: 500 },
    );
  }
}

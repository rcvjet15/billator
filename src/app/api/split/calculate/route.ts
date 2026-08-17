import { NextRequest, NextResponse } from "next/server";

import { getTariffConfig } from "@/lib/config-service";
import { calculateSplit, resolveBlock } from "@/lib/calc/semester";
import type { Reading, SemesterBlock } from "@/lib/calc/types";
import { StorageService } from "@/lib/storage-service";
import { prorateReading } from "@/utils/dates";

/**
 * Readings whose billing period touches `block`, ordered by period start. A
 * reading counts if proration assigns any of its days to the block (covers
 * in-block and straddling bills).
 */
function readingsForBlock(readings: Reading[], block: SemesterBlock): Reading[] {
  return readings
    .filter((r) => {
      const p = prorateReading(
        r.periodStart,
        r.periodEnd,
        r.hepVtKwh,
        r.hepNtKwh,
        r.upperVtKwh,
        r.upperNtKwh,
      );
      const fraction =
        block.type === "winter" ? p.winter.fraction : p.summer.fraction;
      return fraction > 0;
    })
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart));
}

export async function POST(req: NextRequest) {
  let body: { date?: string } = {};
  try {
    body = (await req.json()) as { date?: string };
  } catch {
    // ignore - use default block
  }

  const date = body.date ? new Date(body.date) : new Date();
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  }

  try {
    const storage = StorageService.getInstance();
    const [readings, tariff] = await Promise.all([
      storage.listReadings(),
      getTariffConfig(),
    ]);

    const block = resolveBlock(date);
    const blockReadings = readingsForBlock(readings, block);
    const result = calculateSplit(block, blockReadings, tariff);

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to calculate split." },
      { status: 500 },
    );
  }
}

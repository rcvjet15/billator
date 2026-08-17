import { NextRequest, NextResponse } from "next/server";

import { estimateReadingUpperCost } from "@/lib/calc/readingCost";
import { getTariffConfig } from "@/lib/config-service";
import type { ReadingInput } from "@/lib/calc/types";
import { StorageService } from "@/lib/storage-service";

function validateInput(body: unknown): { input: ReadingInput } | { error: string } {
  if (!body || typeof body !== "object") {
    return { error: "Invalid request body." };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.periodStart !== "string" || typeof b.periodEnd !== "string") {
    return { error: "periodStart and periodEnd must be strings." };
  }

  const names = [
    "hepVtKwh",
    "hepNtKwh",
    "hepTotalSupply",
    "hepFees",
    "hepGrandTotal",
    "upperVtKwh",
    "upperNtKwh",
  ] as const;
  const input: ReadingInput = {
    periodStart: b.periodStart as string,
    periodEnd: b.periodEnd as string,
  };
  for (const name of names) {
    const v = b[name];
    if (v === undefined || v === null || v === "") continue;
    const n = typeof v === "string" ? Number(v) : v;
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0) {
      return { error: `${name} must be a non-negative number.` };
    }
    input[name] = n;
  }
  if (typeof b.sourcePdfId === "string") input.sourcePdfId = b.sourcePdfId;
  if (typeof b.sourcePdfName === "string") input.sourcePdfName = b.sourcePdfName;
  if (b.origin === "parsed" || b.origin === "manual") input.origin = b.origin;

  return { input };
}

export async function GET() {
  try {
    const storage = StorageService.getInstance();
    const [readings, tariff] = await Promise.all([
      storage.listReadings(),
      getTariffConfig().catch(() => null),
    ]);
    // Enrich each reading with an estimated upper-floor cost for the grid.
    const enriched = readings.map((r) => ({
      ...r,
      upperCost: tariff ? estimateReadingUpperCost(r, tariff) : null,
    }));
    return NextResponse.json({ readings: enriched });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to list readings." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = validateInput(body);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  try {
    const storage = StorageService.getInstance();
    const reading = await storage.createReading(result.input);
    return NextResponse.json({ reading }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to create reading." },
      { status: 500 },
    );
  }
}

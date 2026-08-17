import { NextRequest, NextResponse } from "next/server";

import type { ReadingInput } from "@/lib/calc/types";
import { StorageService } from "@/lib/storage-service";

function parseNumber(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function validateInput(body: unknown): { input: ReadingInput } | { error: string } {
  if (!body || typeof body !== "object") {
    return { error: "Invalid request body." };
  }
  const b = body as Record<string, unknown>;

  const hepVtKwh = parseNumber(b.hepVtKwh);
  const hepNtKwh = parseNumber(b.hepNtKwh);
  const hepTotalSupply = parseNumber(b.hepTotalSupply);
  const hepFees = parseNumber(b.hepFees);
  const hepGrandTotal = parseNumber(b.hepGrandTotal);
  const upperVtKwh = parseNumber(b.upperVtKwh);
  const upperNtKwh = parseNumber(b.upperNtKwh);

  if (typeof b.periodStart !== "string" || typeof b.periodEnd !== "string") {
    return { error: "periodStart and periodEnd must be strings." };
  }
  for (const n of [
    hepVtKwh,
    hepNtKwh,
    hepTotalSupply,
    hepFees,
    hepGrandTotal,
    upperVtKwh,
    upperNtKwh,
  ]) {
    if (n === null || n < 0) {
      return { error: "All kWh and amount fields must be non-negative numbers." };
    }
  }

  return {
    input: {
      periodStart: b.periodStart,
      periodEnd: b.periodEnd,
      hepVtKwh: hepVtKwh as number,
      hepNtKwh: hepNtKwh as number,
      hepTotalSupply: hepTotalSupply as number,
      hepFees: hepFees as number,
      hepGrandTotal: hepGrandTotal as number,
      upperVtKwh: upperVtKwh as number,
      upperNtKwh: upperNtKwh as number,
      ...(typeof b.sourcePdfId === "string" ? { sourcePdfId: b.sourcePdfId } : {}),
      ...(typeof b.sourcePdfName === "string"
        ? { sourcePdfName: b.sourcePdfName }
        : {}),
    },
  };
}

export async function GET() {
  try {
    const storage = StorageService.getInstance();
    const readings = await storage.listReadings();
    return NextResponse.json({ readings });
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

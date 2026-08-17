import { NextRequest, NextResponse } from "next/server";

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
  const map = {
    periodStart: "periodStart",
    periodEnd: "periodEnd",
    hepVtKwh: "hepVtKwh",
    hepNtKwh: "hepNtKwh",
    hepTotalSupply: "hepTotalSupply",
    hepFees: "hepFees",
    hepGrandTotal: "hepGrandTotal",
    upperVtKwh: "upperVtKwh",
    upperNtKwh: "upperNtKwh",
  } as const;
  for (const k of Object.keys(map)) {
    const key = k as keyof typeof map;
    if (body[key] !== undefined) {
      const v = body[key];
      if (typeof v === "number") (input as Record<string, unknown>)[map[key]] = v;
      if (typeof v === "string") {
        const n = Number(v);
        (input as Record<string, unknown>)[map[key]] = Number.isFinite(n) ? n : v;
      }
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
    const reading = await storage.updateReading(id, toPartial(body));
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

import { NextRequest, NextResponse } from "next/server";

import { previousReading, resolveReadingDeltas } from "@/lib/calc/delta";
import { StorageService } from "@/lib/storage-service";

type Params = { id: string };

/**
 * Create a reading from a parsed inbox PDF. Uses the stored parse preview to
 * prefill period + HEP fields (including cumulative Stanje od/do), links the
 * reading to the inbox item, and sets origin to "parsed". The upper-floor
 * monitor readings can be added later.
 */
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<Params> },
) {
  const { id } = await ctx.params;
  try {
    const storage = StorageService.getInstance();
    const pdf = await storage.getInboxPdf(id);
    if (!pdf) {
      return NextResponse.json({ error: "Inbox item not found." }, { status: 404 });
    }

    const preview = pdf.parsePreview;
    if (!preview || !preview.periodStart || !preview.periodEnd) {
      return NextResponse.json(
        { error: "This PDF has not been parsed, so a reading can't be created from it." },
        { status: 400 },
      );
    }

    const input = {
      periodStart: preview.periodStart,
      periodEnd: preview.periodEnd,
      hepVtKwh: preview.hepVtKwh,
      hepNtKwh: preview.hepNtKwh,
      hepTotalSupply: preview.hepTotalSupply,
      hepFees: preview.hepFees,
      hepGrandTotal: preview.hepGrandTotal,
      hepStartVt: preview.hepStartVt,
      hepEndVt: preview.hepEndVt,
      hepStartNt: preview.hepStartNt,
      hepEndNt: preview.hepEndNt,
      sourcePdfId: pdf.id,
      sourcePdfName: pdf.filename,
      origin: "parsed" as const,
    };

    // Resolve deltas against the chronological predecessor.
    const all = await storage.listReadings();
    const dup = all.find((r) => r.periodStart === input.periodStart);
    if (dup) {
      return NextResponse.json(
        { error: `A reading already exists for ${input.periodStart}. Edit it instead (${dup.id}).` },
        { status: 409 },
      );
    }
    const prev = previousReading(all, input.periodStart);
    const { consumption, startEnd } = resolveReadingDeltas(input, prev);

    const reading = await storage.createReading({
      ...input,
      ...startEnd,
      hepVtKwh: consumption.hepVtKwh,
      hepNtKwh: consumption.hepNtKwh,
      upperVtKwh: consumption.upperVtKwh,
      upperNtKwh: consumption.upperNtKwh,
    });

    // Link the reading to the inbox item so it's known to be used.
    await storage.updateInboxPdf(id, {
      readingId: reading.id,
      parsedAt: reading.createdAt,
    });

    return NextResponse.json({ reading }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to create reading." },
      { status: 500 },
    );
  }
}

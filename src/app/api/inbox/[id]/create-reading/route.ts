import { NextRequest, NextResponse } from "next/server";

import { createReadingFromInboxPdf } from "@/lib/calc/createReading";
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
    if (!pdf.parsePreview) {
      return NextResponse.json(
        { error: "This PDF has not been parsed, so a reading can't be created from it." },
        { status: 400 },
      );
    }

    const { reading, reason } = await createReadingFromInboxPdf(storage, pdf);
    if (reason === "duplicate") {
      return NextResponse.json(
        { error: `A reading already exists for ${pdf.parsePreview.periodStart}. Edit it instead.` },
        { status: 409 },
      );
    }
    if (reason === "no-preview" || !reading) {
      return NextResponse.json(
        { error: "Could not create a reading from this preview." },
        { status: 400 },
      );
    }
    return NextResponse.json({ reading }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to create reading." },
      { status: 500 },
    );
  }
}

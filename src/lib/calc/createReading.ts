import { previousReading, resolveReadingDeltas } from "@/lib/calc/delta";
import type { Reading, InboxPdf, HepParsePreview, ReadingInput } from "@/lib/calc/types";
import type { StorageService } from "@/lib/storage-service";

export type StorageLike = ReturnType<typeof StorageService["getInstance"]>;

export interface CreateReadingFromPreviewResult {
  reading: Reading | null;
  reason: "created" | "duplicate" | "no-preview" | "failed";
}

/**
 * Create a reading record from a parsed invoice preview, if one does not
 * already exist for the same period. Uses the chronological predecessor to
 * derive monthly consumption from the cumulative meter ends.
 *
 * Used by the inbox "create reading" action and, when auto-parsing is enabled,
 * by the Gmail sync so a newly downloaded parsed invoice is turned straight
 * into a reading.
 */
export async function createReadingFromPreview(
  storage: StorageLike,
  preview: HepParsePreview | undefined,
  source: { id: string; filename: string },
): Promise<CreateReadingFromPreviewResult> {
  if (!preview || !preview.periodStart || !preview.periodEnd) {
    return { reading: null, reason: "no-preview" };
  }

  const input: ReadingInput = {
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
    sourcePdfId: source.id,
    sourcePdfName: source.filename,
    origin: "parsed",
  };

  const all = await storage.listReadings();
  const dup = all.find((r) => r.periodStart === input.periodStart);
  if (dup) {
    return { reading: null, reason: "duplicate" };
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

  await storage
    .updateInboxPdf(source.id, {
      readingId: reading.id,
      parsedAt: new Date().toISOString(),
    })
    .catch(() => undefined);

  return { reading, reason: "created" };
}

/** Create a reading from a stored inbox PDF record. */
export async function createReadingFromInboxPdf(
  storage: StorageLike,
  pdf: InboxPdf,
): Promise<CreateReadingFromPreviewResult> {
  return createReadingFromPreview(storage, pdf.parsePreview, {
    id: pdf.id,
    filename: pdf.filename,
  });
}

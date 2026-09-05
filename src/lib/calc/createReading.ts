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
 * already exist for the same period.
 *
 * The PDF's own "Potrošak" (printed monthly consumption: hepVtKwh/hepNtKwh) is
 * treated as authoritative whenever it is present; the invoiced cumulative
 * Stanje od/od (start/end) are stored for reference but are NOT allowed to
 * overwrite that consumption. The cumulative-delta path is only used when a
 * channel has no parsed consumption yet (e.g. a meter the user later enters by
 * odometer). This avoids corrupting a reading when the parser mis-captures a
 * counter read (the PDF shows the consumption, which is what billing needs).
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

  const hasParsedConsumption =
    preview.hepVtKwh !== undefined && preview.hepNtKwh !== undefined;
  if (hasParsedConsumption) {
    // Trust the printed consumption.
    input.hepVtKwh = preview.hepVtKwh;
    input.hepNtKwh = preview.hepNtKwh;
  }

  const all = await storage.listReadings();
  const dup = all.find((r) => r.periodStart === input.periodStart);
  if (dup) {
    return { reading: null, reason: "duplicate" };
  }

  // Only derive from cumulative counters for channels lacking parsed figures.
  let createInput: ReadingInput = { ...input };
  if (!hasParsedConsumption) {
    const prev = previousReading(all, input.periodStart);
    const { consumption, startEnd } = resolveReadingDeltas(input, prev);
    createInput = {
      ...input,
      ...startEnd,
      hepVtKwh: consumption.hepVtKwh,
      hepNtKwh: consumption.hepNtKwh,
      upperVtKwh: consumption.upperVtKwh,
      upperNtKwh: consumption.upperNtKwh,
    };
  }

  const reading = await storage.createReading(createInput);

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

import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { writeFile } from "node:fs/promises";
import path from "node:path";

import { parseHepInvoice } from "@/lib/parse/hep";
import type { HepParseResult } from "@/lib/parse/hep";
import { StorageService } from "@/lib/storage-service";

function isPdf(buffer: Uint8Array): boolean {
  return (
    buffer.length > 4 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  );
}

/**
 * Extract text from an uploaded HEP PDF, run the invoice regex parser, and
 * persist the PDF to the invoice inbox so it can be downloaded again and linked
 * as the reading's source document.
 *
 * Returns the best-effort prefilled fields (plus the inbox source id); the
 * client always shows an editable manual form on top.
 */
export async function POST(req: NextRequest) {
  let form;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || typeof file === "string" || !("arrayBuffer" in file) || !file.name) {
    return NextResponse.json({ error: "No PDF file provided." }, { status: 400 });
  }

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "Could not read the uploaded file." }, { status: 400 });
  }

  if (!isPdf(bytes)) {
    return NextResponse.json({ error: "Uploaded file is not a PDF." }, { status: 400 });
  }

  let result: HepParseResult;
  try {
    const parser = new PDFParse({ data: bytes as unknown as ArrayBuffer });
    const text = await parser.getText();
    const raw = (text as unknown as { text: string }).text ?? "";
    result = parseHepInvoice(raw);
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to parse PDF: ${(err as Error).message}` },
      { status: 422 },
    );
  }

  // Persist the PDF to the inbox so it's downloadable + linkable as source.
  let sourcePdfId: string | undefined;
  let sourcePdfName = file.name;
  try {
    const settings = await import("@/lib/settings").then((m) => m.loadSettings());
    const rootRel = settings.storage.inboxDir || "./data/inbox";
    const root = path.isAbsolute(rootRel) ? rootRel : path.join(process.cwd(), rootRel);
    const filename = `upload-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    await writeFile(path.join(root, filename), bytes);
    const storage = StorageService.getInstance();
    const item = await storage.addInboxPdf({
      filename: file.name,
      path: path.join(rootRel, filename),
      parsePreview: {
        periodStart: result.periodStart,
        periodEnd: result.periodEnd,
        hepVtKwh: result.hepVtKwh,
        hepNtKwh: result.hepNtKwh,
        hepStartVt: result.hepStartVt,
        hepEndVt: result.hepEndVt,
        hepStartNt: result.hepStartNt,
        hepEndNt: result.hepEndNt,
        hepTotalSupply: result.hepTotalSupply,
        hepFees: result.hepFees,
        hepGrandTotal: result.hepGrandTotal,
        hepOverageKwh: result.hepOverageKwh,
        confidence: result.confidence,
      },
    });
    sourcePdfId = item.id;
    sourcePdfName = file.name;
  } catch (e) {
    // Inbox persistence is best-effort; still return the parsed results.
    console.error("[parse/hep] could not persist inbox record:", (e as Error).message);
  }

  return NextResponse.json({ result, filename: file.name, sourcePdfId, sourcePdfName });
}

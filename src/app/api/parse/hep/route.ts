import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";

import { parseHepInvoice } from "@/lib/parse/hep";
import type { HepParseResult } from "@/lib/parse/hep";

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
 * Extract text from an uploaded HEP PDF and run the invoice regex parser.
 * The file is read in memory and discarded — nothing is persisted (PDFs are
 * only a parsing aid; the parsed numbers become the reading record).
 *
 * Returns the best-effort prefilled fields; the client always shows an
 * editable manual form on top.
 */
export async function POST(req: NextRequest) {
  let form;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || typeof file === "string" || !("arrayBuffer" in file)) {
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
    // pdf-parse returns `text` as the concatenated document string.
    const raw = (text as unknown as { text: string }).text ?? "";
    result = parseHepInvoice(raw);
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to parse PDF: ${(err as Error).message}` },
      { status: 422 },
    );
  }

  return NextResponse.json({ result, filename: file.name });
}

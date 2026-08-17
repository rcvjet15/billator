import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { StorageService } from "@/lib/storage-service";

type Params = { id: string };

export async function GET(
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

    // Resolve the file path (may be relative to cwd).
    const absPath = path.isAbsolute(pdf.path)
      ? pdf.path
      : path.join(process.cwd(), pdf.path);
    const bytes = await readFile(absPath);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${pdf.filename}"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to read PDF." },
      { status: 500 },
    );
  }
}

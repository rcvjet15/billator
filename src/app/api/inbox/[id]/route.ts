import { NextRequest, NextResponse } from "next/server";

import { StorageService } from "@/lib/storage-service";

type Params = { id: string };

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<Params> },
) {
  const { id } = await ctx.params;
  try {
    const storage = StorageService.getInstance();
    const deleted = await storage.deleteInboxPdf(id);
    if (!deleted) {
      return NextResponse.json({ error: "Inbox item not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to delete inbox item." },
      { status: 500 },
    );
  }
}

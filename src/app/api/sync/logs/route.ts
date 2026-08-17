import { NextResponse } from "next/server";

import { StorageService } from "@/lib/storage-service";

export async function GET() {
  try {
    const storage = StorageService.getInstance();
    const logs = await storage.listSyncLogs(100);
    return NextResponse.json({ logs });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to load sync logs." },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const storage = StorageService.getInstance();
    await storage.clearSyncLogs();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to clear sync logs." },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";

import { StorageService } from "@/lib/storage-service";

export async function GET() {
  try {
    const storage = StorageService.getInstance();
    const logs = await storage.listNotificationLogs(100);
    return NextResponse.json({ logs });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to load notification logs." },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const storage = StorageService.getInstance();
    await storage.clearNotificationLogs();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to clear logs." },
      { status: 500 },
    );
  }
}

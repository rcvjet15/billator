import { NextResponse } from "next/server";

import { StorageService } from "@/lib/storage-service";

export async function GET() {
  try {
    const storage = StorageService.getInstance();
    const inbox = await storage.listInboxPdfs();
    return NextResponse.json({ inbox });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to load inbox." },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";

import { StorageService } from "@/lib/storage-service";

/**
 * Delete every inbox record for a given Gmail message id, clearing the local
 * dedup so that specific email can be pulled and auto-parsed again on the next
 * sync.
 */
export async function POST(req: NextRequest) {
  let body: { msgId?: string };
  try {
    body = (await req.json()) as { msgId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const msgId = body?.msgId;
  if (!msgId) {
    return NextResponse.json({ error: "msgId is required." }, { status: 400 });
  }

  try {
    const storage = StorageService.getInstance();
    const removed = await storage.deleteInboxByMsgId(msgId);
    return NextResponse.json({ ok: true, removed });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to clear dedup." },
      { status: 500 },
    );
  }
}

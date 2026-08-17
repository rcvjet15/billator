import { NextResponse } from "next/server";

import { runSync } from "@/lib/gmail/sync";

/** Manually trigger a Gmail sync now. */
export async function POST() {
  try {
    const outcome = await runSync("manual");
    return NextResponse.json({ outcome });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Sync failed." },
      { status: 500 },
    );
  }
}

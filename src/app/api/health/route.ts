import { NextResponse } from "next/server";

import { env } from "@/lib/env";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "billator",
    storageMode: env.storageMode,
    supabaseConfigured: env.supabase.isConfigured(),
    timestamp: new Date().toISOString(),
  });
}

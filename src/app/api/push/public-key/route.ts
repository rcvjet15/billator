import { NextResponse } from "next/server";

import { env } from "@/lib/env";

export function GET() {
  return NextResponse.json({ publicKey: env.vapid.publicKey || null });
}

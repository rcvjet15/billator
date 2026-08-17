import { NextResponse } from "next/server";

import { buildAuthUrl } from "@/lib/gmail/oauth";

/** Start Gmail OAuth: redirect the user to Google for consent. */
export async function GET() {
  const url = await buildAuthUrl();
  if (!url) {
    return NextResponse.json(
      { error: "Gmail is not configured. Set a client ID/secret in Settings first." },
      { status: 400 },
    );
  }
  return NextResponse.redirect(url);
}

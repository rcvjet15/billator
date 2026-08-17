import { NextRequest, NextResponse } from "next/server";

import { exchangeCode } from "@/lib/gmail/oauth";

/**
 * OAuth2 callback. The user is redirected here by Google with a `code`; we
 * exchange it for a refresh token and store it (encrypted) in the DB.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.json(
      { error: `Authorization error: ${error}` },
      { status: 400 },
    );
  }
  if (!code) {
    return NextResponse.json(
      { error: "Missing authorization code." },
      { status: 400 },
    );
  }

  try {
    await exchangeCode(code);
    return NextResponse.json({ ok: true, message: "Gmail authorized." });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to exchange code." },
      { status: 500 },
    );
  }
}

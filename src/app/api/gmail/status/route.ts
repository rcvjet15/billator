import { NextResponse } from "next/server";

import { getGmailClient } from "@/lib/gmail/client";
import { getRefreshToken } from "@/lib/gmail/oauth";
import { loadSettings } from "@/lib/settings";

export async function GET() {
  const settings = await loadSettings();
  const configured = !!settings.gmail.clientId && settings.gmail.hasClientSecret;
  const authorized = !!(await getRefreshToken());
  return NextResponse.json({
    enabled: settings.gmail.enabled,
    configured,
    authorized,
    pollIntervalMs: settings.gmail.pollIntervalMs,
    query: settings.gmail.query,
    // Probe the client to confirm a working auth (best-effort).
    ready: configured && authorized ? !!(await getGmailClient()) : false,
  });
}

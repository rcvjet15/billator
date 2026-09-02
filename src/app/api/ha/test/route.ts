import { NextResponse } from "next/server";

import { sendHaNotification } from "@/lib/ha/notify";
import { loadSettings } from "@/lib/settings";

/**
 * Test the Home Assistant notification bridge. Returns details about whether
 * HA is configured and whether the outgoing notification was delivered, so the
 * settings UI can surface actionable feedback (e.g. "token missing").
 */
export async function POST() {
  const settings = await loadSettings().catch(() => null);
  const ha = settings?.homeAssistant;
  const configured = Boolean(ha && (ha.url || "") && (ha.token || ""));

  let sent = false;
  if (configured) {
    sent = await sendHaNotification({
      title: "Billator test",
      message: "Test from Billator — Home Assistant notifications are working.",
    });
  }

  return NextResponse.json({
    ok: sent,
    sent,
    configured,
    enabled: Boolean(ha?.enabled),
    url: ha?.url || "",
    deviceName: ha?.deviceName || "",
  });
}

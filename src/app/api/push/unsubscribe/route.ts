import { NextResponse } from "next/server";

import { clearSubscription } from "@/lib/push/send";
import { loadSettings, saveSettings } from "@/lib/settings";

export async function POST() {
  await clearSubscription();
  await saveSettings({ notifications: { enabled: false, subscribed: false } } as never);
  const settings = await loadSettings();
  return NextResponse.json({ ok: true, settings });
}

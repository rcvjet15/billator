import { NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";
import { storeSubscription, type PushSubscriptionLike } from "@/lib/push/send";
import { loadSettings, saveSettings } from "@/lib/settings";

export async function POST(req: NextRequest) {
  if (!env.vapid.publicKey || !env.vapid.privateKey) {
    return NextResponse.json(
      { error: "Web Push is not configured (missing VAPID keys)." },
      { status: 501 },
    );
  }

  let body: { subscription?: PushSubscriptionLike };
  try {
    body = (await req.json()) as { subscription?: PushSubscriptionLike };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const sub = body?.subscription;
  if (!sub || !sub.endpoint) {
    return NextResponse.json({ error: "Missing subscription." }, { status: 400 });
  }

  await storeSubscription(sub);
  await saveSettings({ notifications: { enabled: true, subscribed: true } } as never);

  const settings = await loadSettings();
  return NextResponse.json({ ok: true, settings });
}

import webpush from "web-push";

import { env } from "@/lib/env";
import { StorageService } from "@/lib/storage-service";

export interface PushSubscriptionLike {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
  expirationTime?: number | null;
}

export interface PushNotification {
  title: string;
  body?: string;
  url?: string;
}

/** Subscription JSON is stored under this settings key. */
const SUB_KEY = "app.notifications.subscription";

function client(): typeof webpush {
  webpush.setVapidDetails(
    env.vapid.subject || "mailto:robertcvjetkovic15@gmail.com",
    env.vapid.publicKey,
    env.vapid.privateKey,
  );
  return webpush;
}

export async function getStoredSubscription(): Promise<PushSubscriptionLike | null> {
  const storage = StorageService.getInstance();
  const raw = await storage.getSetting(SUB_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PushSubscriptionLike;
    if (!parsed?.endpoint) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function storeSubscription(sub: PushSubscriptionLike): Promise<void> {
  const storage = StorageService.getInstance();
  await storage.setSetting(SUB_KEY, JSON.stringify(sub));
}

export async function clearSubscription(): Promise<void> {
  const storage = StorageService.getInstance();
  await storage.setSetting(SUB_KEY, "");
}

/** Send a push notification to the stored subscription, if any. Best-effort. */
export async function sendPush(notification: PushNotification): Promise<boolean> {
  if (!env.vapid.publicKey || !env.vapid.privateKey) return false;
  const sub = await getStoredSubscription();
  if (!sub || !sub.endpoint) return false;

  try {
    await client().sendNotification(
      sub as webpush.PushSubscription,
      JSON.stringify({
        title: notification.title,
        body: notification.body,
        url: notification.url || "/",
      }),
    );
    return true;
  } catch (err) {
    console.error("[push] failed to send notification:", (err as Error).message);
    // A 404/410 means the subscription is no longer valid; drop it.
    const code = (err as { statusCode?: number }).statusCode;
    if (code === 404 || code === 410) {
      await clearSubscription().catch(() => undefined);
    }
    return false;
  }
}

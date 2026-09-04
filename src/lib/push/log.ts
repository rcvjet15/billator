import type { NotificationChannel, NotificationLogInput } from "@/lib/calc/types";
import { StorageService } from "@/lib/storage-service";

/**
 * Best-effort, fire-and-forget record of a notification delivery attempt.
 * Never throws — logging failures must not disturb the send callers.
 */
export function logNotificationDelivery(
  channel: NotificationChannel,
  input: Omit<NotificationLogInput, "channel">,
): void {
  try {
    const storage = StorageService.getInstance();
    void storage.addNotificationLog({ channel, ...input }).catch((e) => {
      console.error("[notif-log] failed to persist:", (e as Error).message);
    });
  } catch (e) {
    console.error("[notif-log] failed to write:", (e as Error).message);
  }
}

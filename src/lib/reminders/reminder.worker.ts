import { loadSettings } from "@/lib/settings";
import { sendHaNotification } from "@/lib/ha/notify";
import { StorageService } from "@/lib/storage-service";

/** Settings key that records the last date a reminder notification was sent. */
const LAST_KEY = "app.reminders.lastSentDate";

let started = false;
let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/**
 * Whether a reading already exists whose PeriodStart falls in `month` (YYYY-MM).
 * A reading entered for the current month (e.g. 2026-07-01 → …) satisfies it.
 */
async function hasReadingForMonth(storage: ReturnType<typeof StorageService["getInstance"]>, month: string): Promise<boolean> {
  const readings = await storage.listReadings();
  return readings.some((r) => r.periodStart.startsWith(month));
}

/** True on the 1st of the month and for `checkDays-1` more days (inclusive). */
function inReminderWindow(now: Date, checkDays: number): boolean {
  return now.getDate() <= Math.max(1, checkDays);
}

/**
 * Hourly meter-reading reminder worker.
 *
 * From the 1st of each month through day `checkDays`, every hour it checks
 * whether the current month already has a reading (a cumulative counter entry).
 * If not, it fires a Home Assistant "enter your counters" notification once per
 * day (no hourly spam). Stops after the window and picks up again next month.
 */
export async function startReminderWorker(): Promise<void> {
  if (started) return;
  started = true;

  const tick = async (now = new Date()) => {
    if (running) return;
    running = true;
    try {
      const storage = StorageService.getInstance();
      const settings = await loadSettings();
      if (!settings.reminders.enabled) return;

      if (!inReminderWindow(now, settings.reminders.checkDays)) return;

      const month = monthKey(now);
      if (await hasReadingForMonth(storage, month)) return; // already recorded

      // Once per calendar day, not every hour.
      const today = `${month}-${pad(now.getDate())}`;
      const last = await storage.getSetting(LAST_KEY);
      if (last === today) return;

      const ok = await sendHaNotification({
        title: "Meter reading reminder",
        message: `No meter reading recorded for ${month} yet — please enter this month's counters.`,
      });
      if (ok) {
        await storage.setSetting(LAST_KEY, today);
        console.log(`[reminder-worker] ${new Date().toISOString()} sent reminder for ${month}`);
      }
    } catch (e) {
      console.error(`[reminder-worker] error: ${(e as Error).message}`);
    } finally {
      running = false;
    }
  };

  try {
    const settings = await loadSettings();
    if (!settings.reminders.enabled) {
      console.log("[reminder-worker] Reminders disabled — not starting.");
      return;
    }
  } catch (e) {
    console.log(`[reminder-worker] Could not read settings at startup: ${(e as Error).message}`);
    return;
  }

  // Hourly; each tick re-reads settings so toggles/checkDays apply live.
  timer = setInterval(() => void tick(), 60 * 60 * 1000);
  setTimeout(() => void tick(), 15_000); // shortly after boot
}

/** Stop the worker (used in tests). */
export function stopReminderWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
  started = false;
}

// Exported for unit tests: window + last-sent logic reuse.
export { inReminderWindow, monthKey, hasReadingForMonth };

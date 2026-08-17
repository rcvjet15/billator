import { loadSettings } from "@/lib/settings";
import { runSync } from "@/lib/gmail/sync";

let started = false;
let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

/** Start the background Gmail poller. Safe to call once per process. */
export async function startGmailWorker(): Promise<void> {
  if (started) return;
  started = true;

  try {
    const settings = await loadSettings();
    if (!settings.gmail.enabled) {
      console.log(
        `[gmail-worker] Gmail sync disabled — not starting. Enable it in /settings.`,
      );
      return;
    }
  } catch (e) {
    console.log(`[gmail-worker] Could not read settings at startup: ${(e as Error).message}`);
    return;
  }

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const outcome = await runSync("cron");
      console.log(`[gmail-worker] ${new Date().toISOString()} → ${outcome.status}`);
    } catch (e) {
      console.error(
        `[gmail-worker] Sync error: ${(e as Error).message}`,
      );
    } finally {
      running = false;
    }
  };

  // Run on the interval from settings (re-read each tick so edits apply live).
  const schedule = async () => {
    const settings = await loadSettings();
    if (!settings.gmail.enabled) return;
    if (timer) clearInterval(timer);
    timer = setInterval(() => void tick(), settings.gmail.pollIntervalMs || 6 * 3600_000);
    // Initial pass shortly after startup.
    setTimeout(() => void tick(), 10_000);
  };

  await schedule();
  // Re-schedule when settings change (simple approach: listen to a message bus).
  // For a home-server this periodic re-read is sufficient at startup; edits to
  // the interval take effect on next process restart.
}

/** Stop the worker (used in tests). */
export function stopGmailWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
  started = false;
}

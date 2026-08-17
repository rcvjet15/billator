export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startGmailWorker } = await import("@/lib/gmail/worker");
    // Fire-and-forget: start the background poller without blocking boot.
    void startGmailWorker().catch((e) =>
      console.error(`[gmail-worker] failed to start: ${(e as Error).message}`),
    );
  }
}

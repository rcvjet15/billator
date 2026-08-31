export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Install pdf.js DOM polyfills (DOMMatrix/Path2D/ImageData) needed for PDF
    // text extraction in the standalone Node server.
    const { installDomPollyfills } = await import("@/lib/parse/polyfill");
    installDomPollyfills();

    const { startGmailWorker } = await import("@/lib/gmail/worker");
    void startGmailWorker().catch((e) =>
      console.error(`[gmail-worker] failed to start: ${(e as Error).message}`),
    );
  }
}

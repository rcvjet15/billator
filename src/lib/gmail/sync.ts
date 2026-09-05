import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { InboxPdf, SyncLog, SyncTrigger } from "@/lib/calc/types";
import { getGmailClient, type GmailClient } from "@/lib/gmail/client";
import { parseHepPdfBuffer } from "@/lib/parse/hep";
import { sendPush } from "@/lib/push/send";
import { sendHaNotification } from "@/lib/ha/notify";
import { createReadingFromPreview } from "@/lib/calc/createReading";
import { loadSettings } from "@/lib/settings";
import { StorageService } from "@/lib/storage-service";

export interface SyncOutcome {
  ok: boolean;
  found: boolean;
  files: string[];
  messageId?: string;
  error?: string;
  status: string;
  /** Metadata about the newest message that was (or would be) matched. */
  lastEmail?: {
    messageId: string;
    subject?: string;
    from?: string;
    date?: string;
    wasParsed: boolean;
  };
}

/** Resolve an absolute directory for storing invoice PDFs (settings-provided). */
async function resolveRoot(relative: string): Promise<string> {
  const root = path.isAbsolute(relative) ? relative : path.join(process.cwd(), relative);
  await mkdir(root, { recursive: true });
  return root;
}

/** Fetch the raw attachment bytes for a Gmail attachment. */
async function getAttachmentBytes(
  gmail: GmailClient,
  userId: string,
  messageId: string,
  attachmentId: string,
): Promise<Buffer> {
  const res = await gmail.users.messages.attachments.get({
    userId,
    messageId,
    id: attachmentId,
  });
  const data = res.data.data;
  if (!data) throw new Error("Empty attachment data.");
  return Buffer.from(data, "base64url");
}

/** A supported invoice attachment (PDF, or BMP image like "slika.bmp"). */
function isInvoiceAttachment(filename: string | null | undefined): boolean {
  return !!filename && /\.(pdf|bmp|png|jpe?g)$/i.test(filename);
}

interface AttachPart {
  filename?: string | null;
  body?: { attachmentId?: string };
  parts?: AttachPart[];
}

/** Recursively find downloadable attachment parts (including nested). */
function collectAttachments(parts: AttachPart[] | undefined, out: AttachPart[] = []): AttachPart[] {
  for (const p of parts ?? []) {
    if (p.filename && p.body?.attachmentId && isInvoiceAttachment(p.filename)) {
      out.push(p);
    }
    if (p.parts) collectAttachments(p.parts, out);
  }
  return out;
}

/** Whether a message download would duplicate the given Gmail message id. */
async function wasMsgPulled(
  storage: ReturnType<typeof StorageService["getInstance"]>,
  messageId: string,
): Promise<boolean> {
  const inbox = await storage.listInboxPdfs();
  return inbox.some((p) => p.msgId === messageId);
}

/**
 * One sync pass: find HEP emails (by the configured sender/query) with invoice
 * attachments, download them, register them in the inbox, and write a sync log
 * entry.
 *
 * Deduplication is done locally by Gmail message id — an email is pulled at
 * most once even if it was already read (the query deliberately does NOT rely
 * on `is:unread`). Each processed email is marked read as a convenience.
 */
export async function runSync(trigger: SyncTrigger = "sync"): Promise<SyncOutcome> {
  const storage = StorageService.getInstance();
  const settings = await loadSettings();
  if (!settings.gmail.enabled) {
    const log = await logSync(storage, { ok: false, found: false, status: "Gmail sync disabled", trigger });
    return { ok: false, found: false, files: [], messageId: log.messageId, status: log.status };
  }

  const gmail = await getGmailClient();
  if (!gmail) {
    const log = await logSync(storage, {
      ok: false,
      found: false,
      status: "Gmail not authorized",
      trigger,
    });
    return { ok: false, found: false, files: [], messageId: log.messageId, error: log.error, status: log.status };
  }

  const root = await resolveRoot(settings.storage.inboxDir || "./data/inbox");

  try {
    const list = await gmail.users.messages.list({
      userId: "me",
      q: settings.gmail.query,
      maxResults: 20,
    });
    const messages = list.data.messages ?? [];

    if (messages.length === 0) {
      const log = await logSync(storage, {
        ok: true,
        found: false,
        status: "No bills matched the query",
        trigger,
      });
      return { ok: true, found: false, files: [], messageId: log.messageId, status: log.status };
    }

    const files: string[] = [];
    let downloadedCount = 0;
    let skippedCount = 0;
    let lastEmail: SyncOutcome["lastEmail"] = undefined;
    // Track the parsed bill figures for the outgoing notification.
    let parsedVtKwh = 0;
    let parsedNtKwh = 0;
    let parsedGrandTotal: number | undefined;
    let parsedPeriodStart: string | undefined;
    let parsedPeriodEnd: string | undefined;
    let autoCreatedCount = 0;

    for (const msg of messages) {
      const messageId = msg.id!;

      // Skip emails already pulled in prior runs (local dedup by message id).
      if (await wasMsgPulled(storage, messageId)) {
        skippedCount += 1;
        continue;
      }

      const detail = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        // "full" includes the payload parts with attachment ids so we can
        // locate the invoice attachment (metadata alone omits them).
        format: "full",
      });

      const headers = detail.data.payload?.headers ?? [];
      const subject = headers.find((h) => h.name === "Subject")?.value ?? undefined;
      const from = headers.find((h) => h.name === "From")?.value ?? undefined;
      const date = detail.data.internalDate
        ? new Date(Number(detail.data.internalDate)).toISOString()
        : undefined;

      const parts = detail.data.payload?.parts ?? [];
      const attachments = collectAttachments(parts as AttachPart[]);

      if (attachments.length === 0) continue;

      // Track the newest matched email (messages are newest-first).
      let anyParsed = false;
      for (const part of attachments) {
        const ext = path.extname(part.filename || "pdf").toLowerCase();
        const filename = sanitizeFilename(
          part.filename || `invoice-${messageId}.${ext || "pdf"}`,
        );
        const bytes = await getAttachmentBytes(
          gmail,
          "me",
          messageId,
          part.body!.attachmentId!,
        );
        const absPath = path.join(root, filename);
        await writeFile(absPath, bytes);
        files.push(path.join(settings.storage.inboxDir, filename));

        // Auto-parse only works for PDFs. BMP/PNG/JPEG images are stored as
        // records but not parsed (they'd need OCR).
        let parsePreview;
        let parsedAt;
        if (settings.gmail.autoParse && ext === ".pdf") {
          const r = await parseHepPdfBuffer(bytes);
          if (r && r.confidence > 0) {
            anyParsed = true;
            parsedVtKwh = r.hepVtKwh ?? parsedVtKwh;
            parsedNtKwh = r.hepNtKwh ?? parsedNtKwh;
            if (r.hepGrandTotal !== undefined) parsedGrandTotal = r.hepGrandTotal;
            if (r.periodStart) parsedPeriodStart = r.periodStart;
            if (r.periodEnd) parsedPeriodEnd = r.periodEnd;
            parsePreview = {
              periodStart: r.periodStart,
              periodEnd: r.periodEnd,
              hepVtKwh: r.hepVtKwh,
              hepNtKwh: r.hepNtKwh,
              hepStartVt: r.hepStartVt,
              hepEndVt: r.hepEndVt,
              hepStartNt: r.hepStartNt,
              hepEndNt: r.hepEndNt,
              hepTotalSupply: r.hepTotalSupply,
              hepFees: r.hepFees,
              hepGrandTotal: r.hepGrandTotal,
              hepOverageKwh: r.hepOverageKwh,
              confidence: r.confidence,
            } satisfies InboxPdf["parsePreview"];
            parsedAt = new Date().toISOString();
          }
        }

        // Register in inbox.
        const pdf: Omit<InboxPdf, "id" | "downloadedAt"> = {
          filename,
          path: path.join(settings.storage.inboxDir, filename),
          msgId: messageId,
          parsePreview,
          parsedAt,
        };
        const pdfRec = await storage.addInboxPdf(pdf);
        downloadedCount += 1;

        // If auto-parse produced a preview, immediately turn it into a reading
        // (skipped when the period already has one).
        if (parsePreview && pdfRec) {
          const { reason } = await createReadingFromPreview(storage, parsePreview, {
            id: pdfRec.id,
            filename,
          });
          if (reason === "created") autoCreatedCount += 1;
        }
      }

      // Remember the newest matched email for the result popup.
      if (!lastEmail) {
        lastEmail = {
          messageId,
          subject,
          from,
          date,
          wasParsed: anyParsed,
        };
      }

      // Mark the message read (convenience; dedup is by message id, not unread).
      await gmail.users.messages
        .modify({
          userId: "me",
          id: messageId,
          requestBody: { removeLabelIds: ["UNREAD"] },
        })
        .catch(() => undefined);
    }

    // Backfill: turn any parsed inbox PDF that has no reading yet into a
    // reading. This covers invoices pulled on an earlier sync (auto-parse was
    // on) whose "Create reading" step was never run.
    if (settings.gmail.autoParse) {
      const existingReadings = await storage.listReadings();
      const existingPeriods = new Set(existingReadings.map((r) => r.periodStart));
      const inboxPdfs = await storage.listInboxPdfs();
      for (const p of inboxPdfs) {
        if (!p.parsePreview || p.readingId) continue;
        if (!p.parsePreview.periodStart) continue;
        if (existingPeriods.has(p.parsePreview.periodStart)) {
          // Already have a reading for that period; nothing to create.
          continue;
        }
        const { reason } = await createReadingFromPreview(storage, p.parsePreview, {
          id: p.id,
          filename: p.filename,
        });
        if (reason === "created") {
          autoCreatedCount += 1;
          existingPeriods.add(p.parsePreview.periodStart);
        }
      }
    }

    const createdNote =
      autoCreatedCount > 0 ? ` · created ${autoCreatedCount} reading(s)` : "";
    let status: string;
    if (downloadedCount > 0 && autoCreatedCount > 0) {
      status = `Downloaded ${downloadedCount} attachment(s)${createdNote}`;
    } else if (downloadedCount > 0) {
      status = `Downloaded ${downloadedCount} attachment(s)`;
    } else if (autoCreatedCount > 0) {
      status = `Created ${autoCreatedCount} reading(s) from invoices in the inbox`;
    } else if (skippedCount > 0) {
      status = `All matched emails already pulled (${skippedCount} skipped)`;
    } else {
      status = "No invoice attachments found";
    }
    const madeProgress = downloadedCount > 0 || autoCreatedCount > 0;
    const log = await logSync(storage, {
      ok: true,
      found: madeProgress,
      status,
      trigger,
    });

    // Notify when a new invoice produced a reading (or a new bill was synced).
    if (madeProgress) {
      const body = buildBillMessage({ grandTotal: parsedGrandTotal });
      const title =
        autoCreatedCount > 0
          ? "New HEP bill parsed into a reading"
          : "New HEP bill synced";
      const period =
        parsedPeriodStart && parsedPeriodEnd
          ? `${parsedPeriodStart} → ${parsedPeriodEnd}`
          : undefined;

      void sendPush({
        title,
        body: lastEmail?.subject || `Downloaded ${downloadedCount} attachment(s)`,
        url: "/readings",
      }).catch(() => undefined);

      void sendHaNotification({
        title,
        message: body,
        data: period ? { period } : undefined,
      }).catch(() => undefined);
    }

    return {
      ok: true,
      found: madeProgress,
      files,
      messageId: log.messageId,
      status: log.status,
      lastEmail,
    };
  } catch (err) {
    const e = (err as Error).message;
    const log = await logSync(storage, {
      ok: false,
      found: false,
      status: "Sync failed",
      error: e,
      trigger,
    });
    return { ok: false, found: false, files: [], messageId: log.messageId, error: e, status: log.status };
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** Compose a human-friendly summary message from available bill figures. */
function buildBillMessage(opts: {
  grandTotal?: number;
  upperSplit?: number;
}): string {
  const parts: string[] = [];
  if (opts.grandTotal !== undefined) {
    parts.push(`Billed total: €${opts.grandTotal.toFixed(2)}`);
  } else {
    parts.push("A new HEP bill was synced.");
  }
  if (opts.upperSplit !== undefined) {
    parts.push(`Upper floor split: ~€${opts.upperSplit.toFixed(2)}`);
  }
  return parts.join(" · ");
}

async function logSync(
  storage: ReturnType<typeof StorageService["getInstance"]>,
  input: Omit<SyncLog, "id" | "timestamp">,
): Promise<SyncLog> {
  return storage.addSyncLog(input);
}

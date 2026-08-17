import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { InboxPdf, SyncLog, SyncTrigger } from "@/lib/calc/types";
import { getGmailClient, type GmailClient } from "@/lib/gmail/client";
import { parseHepPdfBuffer } from "@/lib/parse/hep";
import { loadSettings } from "@/lib/settings";
import { StorageService } from "@/lib/storage-service";

export interface SyncOutcome {
  ok: boolean;
  found: boolean;
  files: string[];
  messageId?: string;
  error?: string;
  status: string;
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

/**
 * One sync pass: find unread HEP emails with PDF attachments, download the
 * PDFs, register them in the inbox, mark the message read, and write a
 * sync log entry.
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
      maxResults: 10,
    });
    const messages = list.data.messages ?? [];

    if (messages.length === 0) {
      const log = await logSync(storage, {
        ok: true,
        found: false,
        status: "No new bills found",
        trigger,
      });
      return { ok: true, found: false, files: [], messageId: log.messageId, status: log.status };
    }

    const files: string[] = [];
    let downloadedCount = 0;

    for (const msg of messages) {
      const messageId = msg.id!;
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "metadata",
        metadataHeaders: ["From", "Subject"],
      });

      // Find PDF attachments via the included payload part.
      const parts = detail.data.payload?.parts ?? [];
      const pdfParts = parts.filter(
        (p) => p.filename && /\.pdf$/i.test(p.filename) && p.body?.attachmentId,
      );

      if (pdfParts.length === 0) continue;

      for (const part of pdfParts) {
        const filename = sanitizeFilename(part.filename || `invoice-${messageId}.pdf`);
        const bytes = await getAttachmentBytes(
          gmail,
          "me",
          messageId,
          part.body!.attachmentId!,
        );
        const absPath = path.join(root, filename);
        await writeFile(absPath, bytes);
        files.push(path.join(settings.storage.inboxDir, filename));

        // Auto-parse the invoice if enabled; store preview + period on inbox.
        let parsePreview;
        let parsedAt;
        if (settings.gmail.autoParse) {
          const r = await parseHepPdfBuffer(bytes);
          if (r && r.confidence > 0) {
            parsePreview = {
              periodStart: r.periodStart,
              periodEnd: r.periodEnd,
              hepVtKwh: r.hepVtKwh,
              hepNtKwh: r.hepNtKwh,
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
        await storage.addInboxPdf(pdf);
        downloadedCount += 1;
      }

      // Mark the message read.
      await gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: { removeLabelIds: ["UNREAD"] },
      });
    }

    const log = await logSync(storage, {
      ok: true,
      found: downloadedCount > 0,
      status: downloadedCount > 0 ? `Downloaded ${downloadedCount} PDF(s)` : "No PDFs found",
      trigger,
    });

    return {
      ok: true,
      found: downloadedCount > 0,
      files,
      messageId: log.messageId,
      status: log.status,
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

async function logSync(
  storage: ReturnType<typeof StorageService["getInstance"]>,
  input: Omit<SyncLog, "id" | "timestamp">,
): Promise<SyncLog> {
  return storage.addSyncLog(input);
}

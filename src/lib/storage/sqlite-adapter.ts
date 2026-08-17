import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

import type {
  Reading,
  SyncLog,
  InboxPdf,
  TariffConfig,
  SyncTrigger,
  ReadingStatus,
} from "@/lib/calc/types";
import { StorageAdapter } from "@/lib/storage/abstract-storage";

type ReadingRow = {
  id: string;
  period_start: string;
  period_end: string;
  hep_vt_kwh: number;
  hep_nt_kwh: number;
  hep_total_supply: number;
  hep_fees: number;
  hep_grand_total: number;
  upper_vt_kwh: number;
  upper_nt_kwh: number;
  source_pdf_id: string | null;
  source_pdf_name: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
};

type InboxPdfRow = {
  id: string;
  filename: string;
  path: string;
  msg_id: string | null;
  downloaded_at: string;
  parsed_at: string | null;
  reading_id: string | null;
  parse_preview: string | null;
};

type SyncLogRow = {
  id: string;
  timestamp: string;
  ok: number;
  found: number;
  message_id: string | null;
  downloaded_file: string | null;
  error: string | null;
  status: string;
  trigger: SyncTrigger;
};

// bit better-sqlite3 rows are `unknown`; use this helper to read typed objects.
function asReadingRow(r: unknown): ReadingRow {
  return r as ReadingRow;
}
function asInboxPdfRow(r: unknown): InboxPdfRow {
  return r as InboxPdfRow;
}
function asSyncLogRow(r: unknown): SyncLogRow {
  return r as SyncLogRow;
}

/**
 * SQLite storage adapter. A single `.db` file (Docker-volume backed on the
 * Pi) holds readings, settings, sync logs, inbox PDFs and the Gmail OAuth
 * state. Synchronous and fast; ideal for a single-node home server.
 */
export class SqliteAdapter extends StorageAdapter {
  private db: Database.Database;

  constructor(dbPath?: string) {
    super();
    const file =
      dbPath || process.env.DB_PATH || path.join(process.cwd(), "data", "billator.db");
    if (file !== ":memory:") {
      mkdirSync(path.dirname(file), { recursive: true });
    }
    this.db = new Database(file);
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS readings (
        id TEXT PRIMARY KEY,
        period_start TEXT NOT NULL,
        period_end TEXT NOT NULL,
        hep_vt_kwh REAL NOT NULL DEFAULT 0,
        hep_nt_kwh REAL NOT NULL DEFAULT 0,
        hep_total_supply REAL NOT NULL DEFAULT 0,
        hep_fees REAL NOT NULL DEFAULT 0,
        hep_grand_total REAL NOT NULL DEFAULT 0,
        upper_vt_kwh REAL NOT NULL DEFAULT 0,
        upper_nt_kwh REAL NOT NULL DEFAULT 0,
        source_pdf_id TEXT,
        source_pdf_name TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sync_logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        ok INTEGER NOT NULL,
        found INTEGER NOT NULL,
        message_id TEXT,
        downloaded_file TEXT,
        error TEXT,
        status TEXT NOT NULL,
        trigger TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS inbox_pdfs (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        path TEXT NOT NULL,
        msg_id TEXT,
        downloaded_at TEXT NOT NULL,
        parsed_at TEXT,
        reading_id TEXT,
        parse_preview TEXT
      );

      CREATE TABLE IF NOT EXISTS gmail_oauth (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        refresh_token TEXT,
        created_at TEXT,
        updated_at TEXT
      );
    `);

    // Add `status` column if the table predates it (idempotent migration).
    const cols = this.db
      .prepare("PRAGMA table_info(readings)")
      .all() as unknown as { name: string }[];
    if (!cols.some((c) => c.name === "status")) {
      this.db.exec(`ALTER TABLE readings ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'`);
    }
  }

  close(): void {
    this.db.close();
  }

  // ---- readings ----------------------------------------------------------

  private rowToReading(r: ReadingRow): Reading {
    return {
      id: r.id,
      periodStart: r.period_start,
      periodEnd: r.period_end,
      hepVtKwh: r.hep_vt_kwh,
      hepNtKwh: r.hep_nt_kwh,
      hepTotalSupply: r.hep_total_supply,
      hepFees: r.hep_fees,
      hepGrandTotal: r.hep_grand_total,
      upperVtKwh: r.upper_vt_kwh,
      upperNtKwh: r.upper_nt_kwh,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      ...(r.status ? { status: r.status as Reading["status"] } : {}),
      ...(r.source_pdf_id
        ? { sourcePdfId: r.source_pdf_id, sourcePdfName: r.source_pdf_name ?? undefined }
        : {}),
    };
  }

  listReadings(): Promise<Reading[]> {
    const rows = this.db
      .prepare("SELECT * FROM readings ORDER BY period_start DESC")
      .all();
    return Promise.resolve(rows.map((r) => this.rowToReading(asReadingRow(r))));
  }

  getReading(id: string): Promise<Reading | null> {
    const r = this.db.prepare("SELECT * FROM readings WHERE id = ?").get(id) as unknown;
    return Promise.resolve(r ? this.rowToReading(asReadingRow(r)) : null);
  }

  createReading(
    input: {
      periodStart: string;
      periodEnd: string;
      hepVtKwh?: number;
      hepNtKwh?: number;
      hepTotalSupply?: number;
      hepFees?: number;
      hepGrandTotal?: number;
      upperVtKwh?: number;
      upperNtKwh?: number;
      sourcePdfId?: string;
      sourcePdfName?: string;
    },
  ): Promise<Reading> {
    const now = new Date().toISOString();
    const id = randomUUID();
    const status = computeReadingStatus(input);
    this.db
      .prepare(
        `INSERT INTO readings (id, period_start, period_end, hep_vt_kwh, hep_nt_kwh,
          hep_total_supply, hep_fees, hep_grand_total, upper_vt_kwh, upper_nt_kwh,
          source_pdf_id, source_pdf_name, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.periodStart,
        input.periodEnd,
        input.hepVtKwh ?? 0,
        input.hepNtKwh ?? 0,
        input.hepTotalSupply ?? 0,
        input.hepFees ?? 0,
        input.hepGrandTotal ?? 0,
        input.upperVtKwh ?? 0,
        input.upperNtKwh ?? 0,
        input.sourcePdfId ?? null,
        input.sourcePdfName ?? null,
        status,
        now,
        now,
      );
    return this.getReading(id) as Promise<Reading>;
  }

  updateReading(id: string, input: Partial<Reading>): Promise<Reading | null> {
    const existing = this.getReading(id);
    return existing.then((record) => {
      if (!record) return null;
      const merged: Reading = { ...record, ...input, id, updatedAt: new Date().toISOString() };
      const status = computeReadingStatus(merged);
      this.db
        .prepare(
          `UPDATE readings SET period_start=?, period_end=?, hep_vt_kwh=?, hep_nt_kwh=?,
            hep_total_supply=?, hep_fees=?, hep_grand_total=?, upper_vt_kwh=?, upper_nt_kwh=?,
            source_pdf_id=?, source_pdf_name=?, status=?, updated_at=?
           WHERE id=?`,
        )
        .run(
          merged.periodStart,
          merged.periodEnd,
          merged.hepVtKwh ?? 0,
          merged.hepNtKwh ?? 0,
          merged.hepTotalSupply ?? 0,
          merged.hepFees ?? 0,
          merged.hepGrandTotal ?? 0,
          merged.upperVtKwh ?? 0,
          merged.upperNtKwh ?? 0,
          merged.sourcePdfId ?? null,
          merged.sourcePdfName ?? null,
          status,
          merged.updatedAt,
          id,
        );
      return { ...merged, status };
    });
  }

  deleteReading(id: string): Promise<boolean> {
    const info = this.db.prepare("DELETE FROM readings WHERE id = ?").run(id);
    return Promise.resolve(info.changes > 0);
  }

  // ---- tariff config -----------------------------------------------------

  getTariffConfig(): Promise<Partial<TariffConfig> | null> {
    const get = (k: string) => this.getSetting(k).then((v) => (v === null ? undefined : Number(v)));
    return Promise.all([
      get("tariff.energyRateVt"),
      get("tariff.energyRateNt"),
      get("tariff.overageMultiplier"),
      get("tariff.overageThresholdKwh"),
      get("tariff.fixedFee"),
      get("tariff.gridFeeRate"),
      get("tariff.vatRate"),
    ]).then(([energyRateVt, energyRateNt, overageMultiplier, overageThresholdKwh, fixedFee, gridFeeRate, vatRate]) => {
      const cfg: Partial<TariffConfig> = {};
      if (energyRateVt !== undefined) cfg.energyRateVt = energyRateVt;
      if (energyRateNt !== undefined) cfg.energyRateNt = energyRateNt;
      if (overageMultiplier !== undefined) cfg.overageMultiplier = overageMultiplier;
      if (overageThresholdKwh !== undefined) cfg.overageThresholdKwh = overageThresholdKwh;
      if (fixedFee !== undefined) cfg.fixedFee = fixedFee;
      if (gridFeeRate !== undefined) cfg.gridFeeRate = gridFeeRate;
      if (vatRate !== undefined) cfg.vatRate = vatRate;
      return Promise.resolve(Object.keys(cfg).length ? cfg : null);
    });
  }

  setTariffConfig(config: Partial<TariffConfig>): Promise<Partial<TariffConfig>> {
    const entries: [string, string][] = [];
    const defs: [string, number | undefined][] = [
      ["tariff.energyRateVt", config.energyRateVt],
      ["tariff.energyRateNt", config.energyRateNt],
      ["tariff.overageMultiplier", config.overageMultiplier],
      ["tariff.overageThresholdKwh", config.overageThresholdKwh],
      ["tariff.fixedFee", config.fixedFee],
      ["tariff.gridFeeRate", config.gridFeeRate],
      ["tariff.vatRate", config.vatRate],
    ];
    defs.forEach(([k, v]) => {
      if (v !== undefined) entries.push([k, String(v)]);
    });
    const stmt = this.db.prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    );
    const tx = this.db.transaction(() => entries.forEach(([k, v]) => stmt.run(k, v)));
    tx();
    return this.getTariffConfig() as Promise<Partial<TariffConfig>>;
  }

  // ---- settings ----------------------------------------------------------

  getSetting(key: string): Promise<string | null> {
    const r = this.db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
      | { value: string }
      | undefined;
    return Promise.resolve(r ? r.value : null);
  }

  setSetting(key: string, value: string): Promise<void> {
    this.db
      .prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      )
      .run(key, value);
    return Promise.resolve();
  }

  // ---- Gmail OAuth -------------------------------------------------------

  getOAuthState(): Promise<{ refreshToken?: string } | null> {
    const r = this.db
      .prepare("SELECT refresh_token FROM gmail_oauth WHERE id = 1")
      .get() as { refresh_token: string | null } | undefined;
    return Promise.resolve(
      r && r.refresh_token ? { refreshToken: r.refresh_token } : null,
    );
  }

  setOAuthState(state: { refreshToken: string }): Promise<void> {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO gmail_oauth (id, refresh_token, created_at, updated_at)
         VALUES (1, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET refresh_token=excluded.refresh_token, updated_at=excluded.updated_at`,
      )
      .run(state.refreshToken, now, now);
    return Promise.resolve();
  }

  clearOAuthState(): Promise<void> {
    this.db.prepare("DELETE FROM gmail_oauth WHERE id = 1").run();
    return Promise.resolve();
  }

  // ---- sync logs ---------------------------------------------------------

  addSyncLog(log: Omit<SyncLog, "id" | "timestamp">): Promise<SyncLog> {
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO sync_logs (id, timestamp, ok, found, message_id, downloaded_file, error, status, trigger)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        timestamp,
        log.ok ? 1 : 0,
        log.found ? 1 : 0,
        log.messageId ?? null,
        log.downloadedFile ?? null,
        log.error ?? null,
        log.status,
        log.trigger,
      );
    return Promise.resolve({ id, timestamp, ...log });
  }

  listSyncLogs(limit = 50): Promise<SyncLog[]> {
    const rows = this.db
      .prepare("SELECT * FROM sync_logs ORDER BY timestamp DESC LIMIT ?")
      .all(limit) as unknown[];
    return Promise.resolve(
      rows.map((r) => {
        const row = asSyncLogRow(r);
        return {
          id: row.id,
          timestamp: row.timestamp,
          ok: !!row.ok,
          found: !!row.found,
          messageId: row.message_id ?? undefined,
          downloadedFile: row.downloaded_file ?? undefined,
          error: row.error ?? undefined,
          status: row.status,
          trigger: row.trigger,
        };
      }),
    );
  }

  clearSyncLogs(): Promise<void> {
    this.db.prepare("DELETE FROM sync_logs").run();
    return Promise.resolve();
  }

  // ---- inbox PDFs --------------------------------------------------------

  addInboxPdf(pdf: Omit<InboxPdf, "id" | "downloadedAt">): Promise<InboxPdf> {
    const id = randomUUID();
    const downloadedAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO inbox_pdfs (id, filename, path, msg_id, downloaded_at, parsed_at, reading_id, parse_preview)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        pdf.filename,
        pdf.path,
        pdf.msgId ?? null,
        downloadedAt,
        pdf.parsedAt ?? null,
        pdf.readingId ?? null,
        pdf.parsePreview ? JSON.stringify(pdf.parsePreview) : null,
      );
    return this.getInboxPdf(id) as Promise<InboxPdf>;
  }

  private rowToInboxPdf(r: InboxPdfRow): InboxPdf {
    return {
      id: r.id,
      filename: r.filename,
      path: r.path,
      msgId: r.msg_id ?? undefined,
      downloadedAt: r.downloaded_at,
      parsedAt: r.parsed_at ?? undefined,
      readingId: r.reading_id ?? undefined,
      parsePreview: r.parse_preview ? (JSON.parse(r.parse_preview) as InboxPdf["parsePreview"]) : undefined,
    };
  }

  listInboxPdfs(): Promise<InboxPdf[]> {
    const rows = this.db
      .prepare("SELECT * FROM inbox_pdfs ORDER BY downloaded_at DESC")
      .all() as unknown[];
    return Promise.resolve(rows.map((r) => this.rowToInboxPdf(asInboxPdfRow(r))));
  }

  getInboxPdf(id: string): Promise<InboxPdf | null> {
    const r = this.db.prepare("SELECT * FROM inbox_pdfs WHERE id = ?").get(id) as unknown;
    return Promise.resolve(r ? this.rowToInboxPdf(asInboxPdfRow(r)) : null);
  }

  updateInboxPdf(id: string, patch: Partial<InboxPdf>): Promise<InboxPdf | null> {
    const existing = this.getInboxPdf(id);
    return existing.then((record) => {
      if (!record) return null;
      const merged: InboxPdf = { ...record, ...patch };
      this.db
        .prepare(
          `UPDATE inbox_pdfs SET filename=?, path=?, msg_id=?, parsed_at=?, reading_id=?, parse_preview=? WHERE id=?`,
        )
        .run(
          merged.filename,
          merged.path,
          merged.msgId ?? null,
          merged.parsedAt ?? null,
          merged.readingId ?? null,
          merged.parsePreview ? JSON.stringify(merged.parsePreview) : null,
          id,
        );
      return merged;
    });
  }

  deleteInboxPdf(id: string): Promise<boolean> {
    const info = this.db.prepare("DELETE FROM inbox_pdfs WHERE id = ?").run(id);
    return Promise.resolve(info.changes > 0);
  }
}

function computeReadingStatus(r: {
  hepVtKwh?: number;
  hepNtKwh?: number;
  hepTotalSupply?: number;
  hepFees?: number;
  hepGrandTotal?: number;
  upperVtKwh?: number;
  upperNtKwh?: number;
}): ReadingStatus {
  const hasInvoice =
    Number(r.hepVtKwh) > 0 ||
    Number(r.hepNtKwh) > 0 ||
    Number(r.hepGrandTotal) > 0 ||
    Number(r.hepTotalSupply) > 0 ||
    Number(r.hepFees) > 0;
  const hasUpper = Number(r.upperVtKwh) > 0 || Number(r.upperNtKwh) > 0;
  return hasInvoice && hasUpper ? "complete" : "pending";
}

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Reading, TariffConfig, SyncLog, InboxPdf, ReadingStatus } from "@/lib/calc/types";
import { randomUUID } from "node:crypto";
import { StorageAdapter } from "@/lib/storage/abstract-storage";

interface FilesystemState {
  readings: Reading[];
  tariffConfig: Partial<TariffConfig> | null;
  settings: Record<string, string>;
  oauth: { refreshToken?: string } | null;
  syncLogs: SyncLog[];
  inboxPdfs: InboxPdf[];
}

/**
 * Local filesystem adapter for development. Persists state as a JSON file so
 * the app works without Postgres/Supabase wired up. Matches the reference
 * project's `filesystem-adapter.ts` (simple local fallback).
 */
export class FilesystemAdapter extends StorageAdapter {
  private filePath: string;

  constructor(filePath?: string) {
    super();
    this.filePath =
      filePath || process.env.DATA_FILE || path.join(process.cwd(), "data", "store.json");
  }

  private async read(): Promise<FilesystemState> {
    try {
      const raw = await readFile(this.filePath, "utf-8");
      const parsed = JSON.parse(raw) as Partial<FilesystemState>;
      return {
        readings: parsed.readings ?? [],
        tariffConfig: parsed.tariffConfig ?? null,
        settings: parsed.settings ?? {},
        oauth: parsed.oauth ?? null,
        syncLogs: parsed.syncLogs ?? [],
        inboxPdfs: parsed.inboxPdfs ?? [],
      };
    } catch {
      return {
        readings: [],
        tariffConfig: null,
        settings: {},
        oauth: null,
        syncLogs: [],
        inboxPdfs: [],
      };
    }
  }

  private async write(state: FilesystemState): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(state, null, 2), "utf-8");
  }

  async listReadings(): Promise<Reading[]> {
    const state = await this.read();
    return [...state.readings].sort((a, b) =>
      b.periodStart.localeCompare(a.periodStart),
    );
  }

  async getReading(id: string): Promise<Reading | null> {
    const state = await this.read();
    return state.readings.find((r) => r.id === id) ?? null;
  }

  async createReading(
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
      origin?: Reading["origin"];
    },
  ): Promise<Reading> {
    const state = await this.read();
    const now = new Date().toISOString();
    const reading: Reading = {
      ...input,
      hepVtKwh: input.hepVtKwh ?? 0,
      hepNtKwh: input.hepNtKwh ?? 0,
      hepTotalSupply: input.hepTotalSupply ?? 0,
      hepFees: input.hepFees ?? 0,
      hepGrandTotal: input.hepGrandTotal ?? 0,
      upperVtKwh: input.upperVtKwh ?? 0,
      upperNtKwh: input.upperNtKwh ?? 0,
      status: computeFsStatus(input),
      origin: input.origin ?? (input.sourcePdfId ? "parsed" : "manual"),
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    state.readings.push(reading);
    await this.write(state);
    return reading;
  }

  async updateReading(
    id: string,
    input: Partial<Reading>,
  ): Promise<Reading | null> {
    const state = await this.read();
    const found = state.readings.find((r) => r.id === id);
    if (!found) return null;
    const updated: Reading = {
      ...found,
      ...input,
      status: computeFsStatus(input),
      id,
      updatedAt: new Date().toISOString(),
    };
    state.readings = state.readings.map((r) => (r.id === id ? updated : r));
    await this.write(state);
    return updated;
  }

  async deleteReading(id: string): Promise<boolean> {
    const state = await this.read();
    const next = state.readings.filter((r) => r.id !== id);
    if (next.length === state.readings.length) return false;
    state.readings = next;
    await this.write(state);
    return true;
  }

  async getTariffConfig(): Promise<Partial<TariffConfig> | null> {
    const state = await this.read();
    return state.tariffConfig;
  }

  async setTariffConfig(
    config: Partial<TariffConfig>,
  ): Promise<Partial<TariffConfig>> {
    const state = await this.read();
    state.tariffConfig = { ...state.tariffConfig, ...config };
    await this.write(state);
    return state.tariffConfig;
  }

  // ---- settings ----------------------------------------------------------

  async getSetting(key: string): Promise<string | null> {
    const state = await this.read();
    return state.settings[key] ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    const state = await this.read();
    state.settings[key] = value;
    await this.write(state);
  }

  // ---- Gmail OAuth -------------------------------------------------------

  async getOAuthState(): Promise<{ refreshToken?: string } | null> {
    const state = await this.read();
    return state.oauth?.refreshToken ? { refreshToken: state.oauth.refreshToken } : null;
  }

  async setOAuthState(stateObj: { refreshToken: string }): Promise<void> {
    const state = await this.read();
    state.oauth = stateObj;
    await this.write(state);
  }

  async clearOAuthState(): Promise<void> {
    const state = await this.read();
    state.oauth = null;
    await this.write(state);
  }

  // ---- sync logs ---------------------------------------------------------

  async addSyncLog(
    log: Omit<SyncLog, "id" | "timestamp">,
  ): Promise<SyncLog> {
    const state = await this.read();
    const entry: SyncLog = { id: randomUUID(), timestamp: new Date().toISOString(), ...log };
    state.syncLogs.push(entry);
    await this.write(state);
    return entry;
  }

  async listSyncLogs(limit = 50): Promise<SyncLog[]> {
    const state = await this.read();
    return state.syncLogs
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit);
  }

  async clearSyncLogs(): Promise<void> {
    const state = await this.read();
    state.syncLogs = [];
    await this.write(state);
  }

  // ---- inbox PDFs --------------------------------------------------------

  async addInboxPdf(
    pdf: Omit<InboxPdf, "id" | "downloadedAt">,
  ): Promise<InboxPdf> {
    const state = await this.read();
    const entry: InboxPdf = {
      id: randomUUID(),
      downloadedAt: new Date().toISOString(),
      ...pdf,
    };
    state.inboxPdfs.push(entry);
    await this.write(state);
    return entry;
  }

  async listInboxPdfs(): Promise<InboxPdf[]> {
    const state = await this.read();
    return state.inboxPdfs.sort((a, b) => b.downloadedAt.localeCompare(a.downloadedAt));
  }

  async getInboxPdf(id: string): Promise<InboxPdf | null> {
    const state = await this.read();
    return state.inboxPdfs.find((p) => p.id === id) ?? null;
  }

  async updateInboxPdf(
    id: string,
    patch: Partial<InboxPdf>,
  ): Promise<InboxPdf | null> {
    const state = await this.read();
    const found = state.inboxPdfs.find((p) => p.id === id);
    if (!found) return null;
    const merged = { ...found, ...patch };
    state.inboxPdfs = state.inboxPdfs.map((p) => (p.id === id ? merged : p));
    await this.write(state);
    return merged;
  }

  async deleteInboxPdf(id: string): Promise<boolean> {
    const state = await this.read();
    const next = state.inboxPdfs.filter((p) => p.id !== id);
    if (next.length === state.inboxPdfs.length) return false;
    state.inboxPdfs = next;
    await this.write(state);
    return true;
  }
}

function computeFsStatus(r: {
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

import type {
  Reading,
  SyncLog,
  InboxPdf,
  TariffConfig,
} from "@/lib/calc/types";
import { env } from "@/lib/env";
import { StorageAdapter } from "@/lib/storage/abstract-storage";
import { FilesystemAdapter } from "@/lib/storage/filesystem-adapter";
import { SqliteAdapter } from "@/lib/storage/sqlite-adapter";
import { SupabaseAdapter } from "@/lib/storage/supabase-adapter";

/**
 * Singleton facade over the active storage adapter, selected by STORAGE_MODE.
 * Mirrors the reference project's `storage-service.ts` idiom.
 */
class StorageService {
  private static instance: StorageService | null = null;

  private readonly adapter: StorageAdapter;

  private constructor() {
    env.logConfiguration();
    this.adapter = this.createAdapter();
  }

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  static getAdapter(): StorageAdapter {
    return StorageService.getInstance().adapter;
  }

  /** Free the singleton (used in tests). */
  static reset(): void {
    StorageService.instance = null;
  }

  private createAdapter(): StorageAdapter {
    if (env.isSupabaseEnabled()) {
      return new SupabaseAdapter();
    }
    if (env.storageMode === "filesystem") {
      return new FilesystemAdapter();
    }
    return new SqliteAdapter(env.dbPath);
  }

  // ---- readings ----------------------------------------------------------

  listReadings(): Promise<Reading[]> {
    return this.adapter.listReadings();
  }

  getReading(id: string): Promise<Reading | null> {
    return this.adapter.getReading(id);
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
      origin?: Reading["origin"];
    },
  ): Promise<Reading> {
    return this.adapter.createReading(input);
  }

  updateReading(id: string, input: Partial<Reading>): Promise<Reading | null> {
    return this.adapter.updateReading(id, input);
  }

  deleteReading(id: string): Promise<boolean> {
    return this.adapter.deleteReading(id);
  }

  // ---- tariff config -----------------------------------------------------

  getTariffConfig(): Promise<Partial<TariffConfig> | null> {
    return this.adapter.getTariffConfig();
  }

  setTariffConfig(
    config: Partial<TariffConfig>,
  ): Promise<Partial<TariffConfig>> {
    return this.adapter.setTariffConfig(config);
  }

  // ---- settings ----------------------------------------------------------

  getSetting(key: string): Promise<string | null> {
    return this.adapter.getSetting(key);
  }

  setSetting(key: string, value: string): Promise<void> {
    return this.adapter.setSetting(key, value);
  }

  // ---- Gmail OAuth -------------------------------------------------------

  getOAuthState(): Promise<{ refreshToken?: string } | null> {
    return this.adapter.getOAuthState();
  }

  setOAuthState(state: { refreshToken: string }): Promise<void> {
    return this.adapter.setOAuthState(state);
  }

  clearOAuthState(): Promise<void> {
    return this.adapter.clearOAuthState();
  }

  // ---- sync logs ---------------------------------------------------------

  addSyncLog(log: Omit<SyncLog, "id" | "timestamp">): Promise<SyncLog> {
    return this.adapter.addSyncLog(log);
  }

  listSyncLogs(limit?: number): Promise<SyncLog[]> {
    return this.adapter.listSyncLogs(limit);
  }

  clearSyncLogs(): Promise<void> {
    return this.adapter.clearSyncLogs();
  }

  // ---- inbox PDFs --------------------------------------------------------

  addInboxPdf(pdf: Omit<InboxPdf, "id" | "downloadedAt">): Promise<InboxPdf> {
    return this.adapter.addInboxPdf(pdf);
  }

  listInboxPdfs(): Promise<InboxPdf[]> {
    return this.adapter.listInboxPdfs();
  }

  getInboxPdf(id: string): Promise<InboxPdf | null> {
    return this.adapter.getInboxPdf(id);
  }

  updateInboxPdf(
    id: string,
    patch: Partial<InboxPdf>,
  ): Promise<InboxPdf | null> {
    return this.adapter.updateInboxPdf(id, patch);
  }

  deleteInboxPdf(id: string): Promise<boolean> {
    return this.adapter.deleteInboxPdf(id);
  }

  deleteInboxByMsgId(msgId: string): Promise<number> {
    return this.adapter.deleteInboxByMsgId(msgId);
  }
}

export { StorageService };

import type {
  Reading,
  SyncLog,
  InboxPdf,
  TariffConfig,
} from "@/lib/calc/types";

/**
 * Storage abstraction for all persistent data. Concrete adapters implement
 * this for a backend (SQLite, Postgres/Supabase, local filesystem, etc.).
 * Mirrors the reference project's `abstract-storage.ts` idiom.
 */
export abstract class StorageAdapter {
  // ---- readings ----------------------------------------------------------

  abstract listReadings(): Promise<Reading[]>;

  abstract getReading(id: string): Promise<Reading | null>;

  abstract createReading(
    input: Omit<
      Reading,
      "id" | "createdAt" | "updatedAt" | "periodStart" | "periodEnd"
    > & { periodStart: string; periodEnd: string },
  ): Promise<Reading>;

  abstract updateReading(
    id: string,
    input: Partial<Reading>,
  ): Promise<Reading | null>;

  abstract deleteReading(id: string): Promise<boolean>;

  // ---- tariff config (legacy single-row) --------------------------------

  abstract getTariffConfig(): Promise<Partial<TariffConfig> | null>;

  abstract setTariffConfig(
    config: Partial<TariffConfig>,
  ): Promise<Partial<TariffConfig>>;

  // ---- settings (namespaced key/value) ----------------------------------

  abstract getSetting(key: string): Promise<string | null>;

  abstract setSetting(key: string, value: string): Promise<void>;

  // ---- Gmail OAuth -------------------------------------------------------

  abstract getOAuthState(): Promise<{ refreshToken?: string } | null>;

  abstract setOAuthState(state: { refreshToken: string }): Promise<void>;

  abstract clearOAuthState(): Promise<void>;

  // ---- sync logs ---------------------------------------------------------

  abstract addSyncLog(log: Omit<SyncLog, "id" | "timestamp">): Promise<SyncLog>;

  abstract listSyncLogs(limit?: number): Promise<SyncLog[]>;

  abstract clearSyncLogs(): Promise<void>;

  // ---- inbox PDFs --------------------------------------------------------

  abstract addInboxPdf(pdf: Omit<InboxPdf, "id" | "downloadedAt">): Promise<InboxPdf>;

  abstract listInboxPdfs(): Promise<InboxPdf[]>;

  abstract getInboxPdf(id: string): Promise<InboxPdf | null>;

  abstract updateInboxPdf(
    id: string,
    patch: Partial<InboxPdf>,
  ): Promise<InboxPdf | null>;

  abstract deleteInboxPdf(id: string): Promise<boolean>;
}

import type { TariffConfig } from "@/lib/calc/types";

/** Non-secret, DB-backed application settings grouped by feature. */
export interface AppSettings {
  gmail: GmailSettings;
  hepSync: HepSyncSettings;
  storage: StorageSettings;
  tariffs: TariffConfig;
  advanced: AdvancedSettings;
}

export interface GmailSettings {
  enabled: boolean;
  /** Gmail OAuth client ID. Secret stored encrypted; empty means unset. */
  clientId: string;
  /** True when a client secret is stored (never returned in full). */
  hasClientSecret: boolean;
  /** Encrypted-at-rest client secret. Only present server-side. */
  clientSecret?: string;
  pollIntervalMs: number;
  query: string;
  redirectUri: string;
}

export interface HepSyncSettings {
  /** Configurable source URL for official tariff prices. */
  sourceUrl: string;
  /** When true, fall back to the bundled baseline template. */
  useBaselineFallback: boolean;
}

export interface StorageSettings {
  pdfDir: string;
  inboxDir: string;
}

export interface AdvancedSettings {
  /** Min sync-log rows kept (older entries pruned). */
  syncLogRetention: number;
}

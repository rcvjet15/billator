import type { TariffConfig } from "@/lib/calc/types";

/** Non-secret, DB-backed application settings grouped by feature. */
export interface AppSettings {
  gmail: GmailSettings;
  hepSync: HepSyncSettings;
  storage: StorageSettings;
  tariffs: TariffConfig;
  semesters: SemesterCycleSettings;
  notifications: NotificationsSettings;
  advanced: AdvancedSettings;
}

/** Web Push notification settings. */
export interface NotificationsSettings {
  /** Master toggle: whether push notifications are desired. */
  enabled: boolean;
  /** True when a push subscription for this origin is stored. */
  subscribed: boolean;
}

/** When each 6-month tariff cycle starts/ends (month/day, 1-based). */
export interface SemesterCycleSettings {
  /** Winter cycle: start (e.g. Oct 1) and end (e.g. Mar 31). */
  winterStartDay: number;
  winterStartMonth: number;
  winterEndDay: number;
  winterEndMonth: number;
  /** Summer cycle: start (e.g. Apr 1) and end (e.g. Sep 30). */
  summerStartDay: number;
  summerStartMonth: number;
  summerEndDay: number;
  summerEndMonth: number;
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
  /** If true, the sync worker parses downloaded PDFs (invoice data) automatically. */
  autoParse: boolean;
}

export interface HepSyncSettings {
  /** Which HEP household tariff model to use (e.g. "Bijeli", "Plavi"). */
  tariffModel: string;
}

export interface StorageSettings {
  pdfDir: string;
  inboxDir: string;
}

export interface AdvancedSettings {
  /** Min sync-log rows kept (older entries pruned). */
  syncLogRetention: number;
}

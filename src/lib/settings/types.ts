import type { TariffConfig } from "@/lib/calc/types";

/** Non-secret, DB-backed application settings grouped by feature. */
export interface AppSettings {
  gmail: GmailSettings;
  hepSync: HepSyncSettings;
  storage: StorageSettings;
  tariffs: TariffConfig;
  semesters: SemesterCycleSettings;
  notifications: NotificationsSettings;
  homeAssistant: HomeAssistantSettings;
  reminders: RemindersSettings;
  payments: PaymentsSettings;
  advanced: AdvancedSettings;
}

/** Monthly "still no reading" reminder, sent via Home Assistant. */
export interface RemindersSettings {
  /** Master toggle for the reading reminder. */
  enabled: boolean;
  /** For how many days after the 1st (inclusive) to keep reminding hourly. */
  checkDays: number;
}

/** Settlement/payment recipients and link templates (KEKS Pay, Revolut). */
export interface PaymentsSettings {
  /** Default recipient shown under KEKS Pay (phone/alias). */
  keksRecipient: string;
  /** Custom KEKS deep-link template; default kekspay://… {amount}{note}{recipient}. */
  keksTemplate: string;
  /** Default Revolut.me username/tag. */
  revolutUsername: string;
  /** Custom Revolut.me link template; default https://revolut.me/{username}/{currency}{amount}/{note}. */
  revolutTemplate: string;
  /** Currency code used in the Revolut link (default "eur"). */
  revolutCurrency: string;
  /** Default payment method preselected in the payment modal. */
  defaultMethod: "KEKS Pay" | "Revolut";
}

/** Home Assistant outgoing notification bridge. */
export interface HomeAssistantSettings {
  /** Master toggle for Home Assistant notifications. */
  enabled: boolean;
  /** Base URL of the Home Assistant instance, e.g. http://192.168.1.20:8123. */
  url: string;
  /** Long-Lived Access Token (LLAT) for authorization. */
  token: string;
  /** Device/entity name targeting the notify service (mobile_app_<name>). */
  deviceName: string;
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

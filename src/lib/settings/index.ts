import type { TariffConfig } from "@/lib/calc/types";
import { DEFAULT_CONFIG } from "@/lib/default-config";
import { StorageService } from "@/lib/storage-service";
import type {
  AppSettings,
  PaymentsSettings,
  SemesterCycleSettings,
} from "@/lib/settings/types";

const DEFAULTS: AppSettings = {
  gmail: {
    enabled: false,
    clientId: "",
    hasClientSecret: false,
    pollIntervalMs: 6 * 60 * 60 * 1000, // 6 hours
    query: "from:elektra.racuni-RI@hep.hr has:attachment",
    redirectUri: "http://localhost:3000/api/gmail/auth/callback",
    autoParse: false,
  },
  hepSync: {
    tariffModel: "Bijeli",
  },
  storage: {
    pdfDir: "./data/inbox",
    inboxDir: "./data/inbox",
  },
  tariffs: DEFAULT_CONFIG,
  semesters: {
    // Winter: Oct 1 – Mar 31
    winterStartDay: 1,
    winterStartMonth: 10,
    winterEndDay: 31,
    winterEndMonth: 3,
    // Summer: Apr 1 – Sep 30
    summerStartDay: 1,
    summerStartMonth: 4,
    summerEndDay: 30,
    summerEndMonth: 9,
  },
  notifications: {
    enabled: false,
    subscribed: false,
  },
  homeAssistant: {
    enabled: true,
    url: "http://homeassistant.local:8123",
    token: "",
    deviceName: "phone",
  },
  reminders: {
    enabled: true,
    checkDays: 3,
  },
  payments: {
    keksRecipient: "",
    keksTemplate: "kekspay://pay?amount={amount}&note={note}&recipient={recipient}",
    revolutUsername: "",
    revolutTemplate: "https://revolut.me/{username}/{currency}{amount}/{note}",
    revolutCurrency: "eur",
    defaultMethod: "Revolut",
  },
  advanced: {
    syncLogRetention: 100,
  },
};

const KEY_PREFIX = "app.";

function num(v: string | null): number | undefined {
  if (v === null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function bool(v: string | null): boolean | undefined {
  if (v === null) return undefined;
  return v === "true";
}

/**
 * Resolve the full effective settings by merging DB-backed values over the
 * defaults. Secrets (Gmail client secret) are handled separately by the
 * secret store and are not part of this merge.
 */
export async function loadSettings(): Promise<AppSettings> {
  const storage = StorageService.getInstance();
  const s = { ...DEFAULTS };

  s.gmail = {
    ...s.gmail,
    enabled: bool(await storage.getSetting(`${KEY_PREFIX}gmail.enabled`)) ?? s.gmail.enabled,
    clientId:
      (await storage.getSetting(`${KEY_PREFIX}gmail.clientId`)) || s.gmail.clientId,
    hasClientSecret:
      (await storage.getSetting(`${KEY_PREFIX}gmail.hasClientSecret`)) === "true",
    pollIntervalMs:
      num(await storage.getSetting(`${KEY_PREFIX}gmail.pollIntervalMs`)) ??
      s.gmail.pollIntervalMs,
    query: (await storage.getSetting(`${KEY_PREFIX}gmail.query`)) || s.gmail.query,
    redirectUri:
      (await storage.getSetting(`${KEY_PREFIX}gmail.redirectUri`)) || s.gmail.redirectUri,
    autoParse:
      bool(await storage.getSetting(`${KEY_PREFIX}gmail.autoParse`)) ?? s.gmail.autoParse,
  };

  s.hepSync = {
    ...s.hepSync,
    tariffModel:
      (await storage.getSetting(`${KEY_PREFIX}hepSync.tariffModel`)) || s.hepSync.tariffModel,
  };

  s.storage = {
    ...s.storage,
    pdfDir: (await storage.getSetting(`${KEY_PREFIX}storage.pdfDir`)) || s.storage.pdfDir,
    inboxDir:
      (await storage.getSetting(`${KEY_PREFIX}storage.inboxDir`)) || s.storage.inboxDir,
  };

  s.tariffs = { ...s.tariffs, ...((await storage.getTariffConfig()) ?? {}) };

  const loadSem = async (
    prefix: string,
    def: SemesterCycleSettings,
  ): Promise<SemesterCycleSettings> => ({
    ...def,
    winterStartDay:
      num(await storage.getSetting(`${KEY_PREFIX}${prefix}.winterStartDay`)) ?? def.winterStartDay,
    winterStartMonth:
      num(await storage.getSetting(`${KEY_PREFIX}${prefix}.winterStartMonth`)) ?? def.winterStartMonth,
    winterEndDay:
      num(await storage.getSetting(`${KEY_PREFIX}${prefix}.winterEndDay`)) ?? def.winterEndDay,
    winterEndMonth:
      num(await storage.getSetting(`${KEY_PREFIX}${prefix}.winterEndMonth`)) ?? def.winterEndMonth,
    summerStartDay:
      num(await storage.getSetting(`${KEY_PREFIX}${prefix}.summerStartDay`)) ?? def.summerStartDay,
    summerStartMonth:
      num(await storage.getSetting(`${KEY_PREFIX}${prefix}.summerStartMonth`)) ?? def.summerStartMonth,
    summerEndDay:
      num(await storage.getSetting(`${KEY_PREFIX}${prefix}.summerEndDay`)) ?? def.summerEndDay,
    summerEndMonth:
      num(await storage.getSetting(`${KEY_PREFIX}${prefix}.summerEndMonth`)) ?? def.summerEndMonth,
  });
  s.semesters = await loadSem("semesters", s.semesters);

  s.notifications = {
    enabled:
      bool(await storage.getSetting(`${KEY_PREFIX}notifications.enabled`)) ??
      s.notifications.enabled,
    subscribed:
      bool(await storage.getSetting(`${KEY_PREFIX}notifications.subscribed`)) ??
      s.notifications.subscribed,
  };

  s.homeAssistant = {
    ...s.homeAssistant,
    enabled:
      bool(await storage.getSetting(`${KEY_PREFIX}homeAssistant.enabled`)) ??
      s.homeAssistant.enabled,
    url: (await storage.getSetting(`${KEY_PREFIX}homeAssistant.url`)) || s.homeAssistant.url,
    token: (await storage.getSetting(`${KEY_PREFIX}homeAssistant.token`)) || s.homeAssistant.token,
    deviceName:
      (await storage.getSetting(`${KEY_PREFIX}homeAssistant.deviceName`)) ||
      s.homeAssistant.deviceName,
  };

  s.reminders = {
    ...s.reminders,
    enabled:
      bool(await storage.getSetting(`${KEY_PREFIX}reminders.enabled`)) ??
      s.reminders.enabled,
    checkDays:
      num(await storage.getSetting(`${KEY_PREFIX}reminders.checkDays`)) ??
      s.reminders.checkDays,
  };

  s.payments = {
    ...s.payments,
    keksRecipient:
      (await storage.getSetting(`${KEY_PREFIX}payments.keksRecipient`)) ||
      s.payments.keksRecipient,
    keksTemplate:
      (await storage.getSetting(`${KEY_PREFIX}payments.keksTemplate`)) ||
      s.payments.keksTemplate,
    revolutUsername:
      (await storage.getSetting(`${KEY_PREFIX}payments.revolutUsername`)) ||
      s.payments.revolutUsername,
    revolutTemplate:
      (await storage.getSetting(`${KEY_PREFIX}payments.revolutTemplate`)) ||
      s.payments.revolutTemplate,
    revolutCurrency:
      (await storage.getSetting(`${KEY_PREFIX}payments.revolutCurrency`)) ||
      s.payments.revolutCurrency,
    defaultMethod:
      ((await storage.getSetting(`${KEY_PREFIX}payments.defaultMethod`)) as PaymentsSettings["defaultMethod"]) ||
      s.payments.defaultMethod,
  };

  s.advanced = {
    ...s.advanced,
    syncLogRetention:
      num(await storage.getSetting(`${KEY_PREFIX}advanced.syncLogRetention`)) ??
      s.advanced.syncLogRetention,
  };

  return s;
}

/** Persist a partial update of DB-backed settings (tariff handled too). */
export async function saveSettings(
  patch: Partial<AppSettings>,
): Promise<AppSettings> {
  const storage = StorageService.getInstance();
  const set = (key: string, value?: string | boolean | number) => {
    if (value === undefined) return;
    void storage.setSetting(key, String(value));
  };

  if (patch.gmail) {
    const g = patch.gmail;
    if (g.enabled !== undefined) set(`${KEY_PREFIX}gmail.enabled`, g.enabled);
    if (g.clientId !== undefined) set(`${KEY_PREFIX}gmail.clientId`, g.clientId);
    if (g.pollIntervalMs !== undefined)
      set(`${KEY_PREFIX}gmail.pollIntervalMs`, g.pollIntervalMs);
    if (g.query !== undefined) set(`${KEY_PREFIX}gmail.query`, g.query);
    if (g.redirectUri !== undefined)
      set(`${KEY_PREFIX}gmail.redirectUri`, g.redirectUri);
    if (g.autoParse !== undefined) set(`${KEY_PREFIX}gmail.autoParse`, g.autoParse);
  }

  if (patch.hepSync) {
    const h = patch.hepSync;
    if (h.tariffModel !== undefined)
      set(`${KEY_PREFIX}hepSync.tariffModel`, h.tariffModel);
  }

  if (patch.storage) {
    const st = patch.storage;
    if (st.pdfDir !== undefined) set(`${KEY_PREFIX}storage.pdfDir`, st.pdfDir);
    if (st.inboxDir !== undefined) set(`${KEY_PREFIX}storage.inboxDir`, st.inboxDir);
  }

  if (patch.tariffs) {
    await storage.setTariffConfig(patch.tariffs as Partial<TariffConfig>);
  }

  if (patch.semesters) {
    const sm = patch.semesters;
    const setSem = (key: string, value?: number) => {
      if (value === undefined) return;
      set(`${KEY_PREFIX}semesters.${key}`, value);
    };
    setSem("winterStartDay", sm.winterStartDay);
    setSem("winterStartMonth", sm.winterStartMonth);
    setSem("winterEndDay", sm.winterEndDay);
    setSem("winterEndMonth", sm.winterEndMonth);
    setSem("summerStartDay", sm.summerStartDay);
    setSem("summerStartMonth", sm.summerStartMonth);
    setSem("summerEndDay", sm.summerEndDay);
    setSem("summerEndMonth", sm.summerEndMonth);
  }

  if (patch.notifications) {
    const n = patch.notifications;
    if (n.enabled !== undefined) set(`${KEY_PREFIX}notifications.enabled`, n.enabled);
    if (n.subscribed !== undefined)
      set(`${KEY_PREFIX}notifications.subscribed`, n.subscribed);
  }

  if (patch.homeAssistant) {
    const ha = patch.homeAssistant;
    if (ha.enabled !== undefined)
      set(`${KEY_PREFIX}homeAssistant.enabled`, ha.enabled);
    if (ha.url !== undefined) set(`${KEY_PREFIX}homeAssistant.url`, ha.url);
    if (ha.token !== undefined) set(`${KEY_PREFIX}homeAssistant.token`, ha.token);
    if (ha.deviceName !== undefined)
      set(`${KEY_PREFIX}homeAssistant.deviceName`, ha.deviceName);
  }

  if (patch.reminders) {
    const r = patch.reminders;
    if (r.enabled !== undefined) set(`${KEY_PREFIX}reminders.enabled`, r.enabled);
    if (r.checkDays !== undefined)
      set(`${KEY_PREFIX}reminders.checkDays`, r.checkDays);
  }

  if (patch.payments) {
    const p = patch.payments;
    if (p.keksRecipient !== undefined)
      set(`${KEY_PREFIX}payments.keksRecipient`, p.keksRecipient);
    if (p.keksTemplate !== undefined)
      set(`${KEY_PREFIX}payments.keksTemplate`, p.keksTemplate);
    if (p.revolutUsername !== undefined)
      set(`${KEY_PREFIX}payments.revolutUsername`, p.revolutUsername);
    if (p.revolutTemplate !== undefined)
      set(`${KEY_PREFIX}payments.revolutTemplate`, p.revolutTemplate);
    if (p.revolutCurrency !== undefined)
      set(`${KEY_PREFIX}payments.revolutCurrency`, p.revolutCurrency);
    if (p.defaultMethod !== undefined)
      set(`${KEY_PREFIX}payments.defaultMethod`, p.defaultMethod);
  }

  if (patch.advanced) {
    const a = patch.advanced;
    if (a.syncLogRetention !== undefined)
      set(`${KEY_PREFIX}advanced.syncLogRetention`, a.syncLogRetention);
  }

  return loadSettings();
}

export { DEFAULTS as DEFAULT_SETTINGS };

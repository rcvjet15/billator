import type { TariffConfig } from "@/lib/calc/types";
import { DEFAULT_CONFIG } from "@/lib/default-config";
import { StorageService } from "@/lib/storage-service";
import type { AppSettings } from "@/lib/settings/types";

const DEFAULTS: AppSettings = {
  gmail: {
    enabled: false,
    clientId: "",
    hasClientSecret: false,
    pollIntervalMs: 6 * 60 * 60 * 1000, // 6 hours
    query: "from:hep.hr has:attachment is:unread",
    redirectUri: "http://localhost:3000/api/gmail/auth/callback",
  },
  hepSync: {
    sourceUrl: "",
    useBaselineFallback: true,
  },
  storage: {
    pdfDir: "./data/inbox",
    inboxDir: "./data/inbox",
  },
  tariffs: DEFAULT_CONFIG,
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
  };

  s.hepSync = {
    ...s.hepSync,
    sourceUrl:
      (await storage.getSetting(`${KEY_PREFIX}hepSync.sourceUrl`)) || s.hepSync.sourceUrl,
    useBaselineFallback:
      bool(await storage.getSetting(`${KEY_PREFIX}hepSync.useBaselineFallback`)) ??
      s.hepSync.useBaselineFallback,
  };

  s.storage = {
    ...s.storage,
    pdfDir: (await storage.getSetting(`${KEY_PREFIX}storage.pdfDir`)) || s.storage.pdfDir,
    inboxDir:
      (await storage.getSetting(`${KEY_PREFIX}storage.inboxDir`)) || s.storage.inboxDir,
  };

  s.tariffs = { ...s.tariffs, ...((await storage.getTariffConfig()) ?? {}) };

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
  }

  if (patch.hepSync) {
    const h = patch.hepSync;
    if (h.sourceUrl !== undefined) set(`${KEY_PREFIX}hepSync.sourceUrl`, h.sourceUrl);
    if (h.useBaselineFallback !== undefined)
      set(`${KEY_PREFIX}hepSync.useBaselineFallback`, h.useBaselineFallback);
  }

  if (patch.storage) {
    const st = patch.storage;
    if (st.pdfDir !== undefined) set(`${KEY_PREFIX}storage.pdfDir`, st.pdfDir);
    if (st.inboxDir !== undefined) set(`${KEY_PREFIX}storage.inboxDir`, st.inboxDir);
  }

  if (patch.tariffs) {
    await storage.setTariffConfig(patch.tariffs as Partial<TariffConfig>);
  }

  if (patch.advanced) {
    const a = patch.advanced;
    if (a.syncLogRetention !== undefined)
      set(`${KEY_PREFIX}advanced.syncLogRetention`, a.syncLogRetention);
  }

  return loadSettings();
}

export { DEFAULTS as DEFAULT_SETTINGS };

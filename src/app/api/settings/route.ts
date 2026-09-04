import { NextRequest, NextResponse } from "next/server";

import { loadSettings, saveSettings } from "@/lib/settings";
import { SecretStore } from "@/lib/security/secret";
import type { AppSettings } from "@/lib/settings/types";
import { StorageService } from "@/lib/storage-service";

/** Settings returned to the client, with secrets masked. */
function toClient(settings: AppSettings): AppSettings {
  return {
    ...settings,
    gmail: {
      ...settings.gmail,
      clientId: settings.gmail.clientId,
      // Mask the secret; only a boolean flag is exposed.
      clientSecret:
        settings.gmail.hasClientSecret ? "########" : "",
    },
    homeAssistant: {
      ...settings.homeAssistant,
      // Mask the token; the settings form treats it as write-only.
      token: settings.homeAssistant.token ? "########" : "",
    },
  };
}

export async function GET() {
  try {
    const settings = await loadSettings();
    return NextResponse.json({ settings: toClient(settings) });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to load settings." },
      { status: 500 },
    );
  }
}

function toNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export async function PUT(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const b = (body || {}) as Record<string, unknown>;
  const gmail = (b.gmail || {}) as Record<string, unknown>;
  const hepSync = (b.hepSync || {}) as Record<string, unknown>;
  const storage = (b.storage || {}) as Record<string, unknown>;
  const tariffs = (b.tariffs || {}) as Record<string, unknown>;
  const semesters = (b.semesters || {}) as Record<string, unknown>;
  const notifications = (b.notifications || {}) as Record<string, unknown>;
  const homeAssistant = (b.homeAssistant || {}) as Record<string, unknown>;
  const reminders = (b.reminders || {}) as Record<string, unknown>;
  const payments = (b.payments || {}) as Record<string, unknown>;
  const advanced = (b.advanced || {}) as Record<string, unknown>;

  try {
    const storageService = StorageService.getInstance();

    // Gmail
    const gmailPatch: Partial<AppSettings["gmail"]> = {};
    if (gmail.enabled !== undefined) gmailPatch.enabled = !!gmail.enabled;
    if (typeof gmail.clientId === "string") gmailPatch.clientId = gmail.clientId;
    if (typeof gmail.pollIntervalMs === "number")
      gmailPatch.pollIntervalMs = gmail.pollIntervalMs;
    if (typeof gmail.query === "string") gmailPatch.query = gmail.query;
    if (typeof gmail.redirectUri === "string")
      gmailPatch.redirectUri = gmail.redirectUri;
    if (gmail.autoParse !== undefined) gmailPatch.autoParse = !!gmail.autoParse;

    // Client secret is write-only: encrypt + persist, then flip the flag.
    if (typeof gmail.clientSecret === "string" && gmail.clientSecret && gmail.clientSecret !== "########") {
      const secret = SecretStore.getInstance().encrypt(gmail.clientSecret);
      await storageService.setSetting(
        "app.gmail.clientSecretEnc",
        secret,
      );
      await storageService.setSetting("app.gmail.hasClientSecret", "true");
      gmailPatch.hasClientSecret = true;
    }

    await saveSettings({ gmail: gmailPatch } as Partial<AppSettings>);

    // HEP sync
    const hepPatch: Partial<AppSettings["hepSync"]> = {};
    if (typeof hepSync.tariffModel === "string") hepPatch.tariffModel = hepSync.tariffModel;
    await saveSettings({ hepSync: hepPatch } as Partial<AppSettings>);

    // Storage
    const storagePatch: Partial<AppSettings["storage"]> = {};
    if (typeof storage.pdfDir === "string") storagePatch.pdfDir = storage.pdfDir;
    if (typeof storage.inboxDir === "string") storagePatch.inboxDir = storage.inboxDir;
    await saveSettings({ storage: storagePatch } as Partial<AppSettings>);

    // Tariffs (numeric-only)
    const tariffPatch: Partial<AppSettings["tariffs"]> = {};
    const tariffKeys: (keyof AppSettings["tariffs"])[] = [
      "energyRateVt",
      "energyRateNt",
      "energyRateJt",
      "overageMultiplier",
      "overageThresholdKwh",
      "fixedFee",
      "meteringFee",
      "transmissionRate",
      "distributionRateVt",
      "distributionRateNt",
      "oieRate",
      "vatRate",
    ];
    for (const k of tariffKeys) {
      const v = toNumber(tariffs[k]);
      if (v !== undefined) (tariffPatch as Record<string, number>)[k] = v;
    }
    if (Object.keys(tariffPatch).length > 0) {
      await saveSettings({ tariffs: tariffPatch } as Partial<AppSettings>);
    }

    // Advanced
    const advPatch: Partial<AppSettings["advanced"]> = {};
    const ret = toNumber(advanced.syncLogRetention);
    if (ret !== undefined) advPatch.syncLogRetention = ret;
    await saveSettings({ advanced: advPatch } as Partial<AppSettings>);

    // Semesters (cycle boundaries)
    const semPatch: Partial<AppSettings["semesters"]> = {};
    const semKeys: (keyof AppSettings["semesters"])[] = [
      "winterStartDay",
      "winterStartMonth",
      "winterEndDay",
      "winterEndMonth",
      "summerStartDay",
      "summerStartMonth",
      "summerEndDay",
      "summerEndMonth",
    ];
    for (const k of semKeys) {
      const v = toNumber(semesters[k]);
      if (v !== undefined) (semPatch as Record<string, number>)[k] = v;
    }
    if (Object.keys(semPatch).length > 0) {
      await saveSettings({ semesters: semPatch } as Partial<AppSettings>);
    }

    // Notifications
    const notifPatch: Partial<AppSettings["notifications"]> = {};
    if (typeof notifications.enabled === "boolean")
      notifPatch.enabled = notifications.enabled;
    if (typeof notifications.subscribed === "boolean")
      notifPatch.subscribed = notifications.subscribed;
    if (Object.keys(notifPatch).length > 0) {
      await saveSettings({ notifications: notifPatch } as Partial<AppSettings>);
    }

    // Home Assistant
    const haPatch: Partial<AppSettings["homeAssistant"]> = {};
    if (typeof homeAssistant.enabled === "boolean")
      haPatch.enabled = homeAssistant.enabled;
    if (typeof homeAssistant.url === "string") haPatch.url = homeAssistant.url;
    if (typeof homeAssistant.deviceName === "string")
      haPatch.deviceName = homeAssistant.deviceName;
    // Token is write-only: ignore the "########" mask and only persist a real token.
    if (
      typeof homeAssistant.token === "string" &&
      homeAssistant.token &&
      homeAssistant.token !== "########"
    ) {
      haPatch.token = homeAssistant.token;
    }
    if (Object.keys(haPatch).length > 0) {
      await saveSettings({ homeAssistant: haPatch } as Partial<AppSettings>);
    }

    // Reminders
    const remPatch: Partial<AppSettings["reminders"]> = {};
    if (typeof reminders.enabled === "boolean")
      remPatch.enabled = reminders.enabled;
    if (typeof reminders.checkDays === "number")
      remPatch.checkDays = reminders.checkDays;
    if (Object.keys(remPatch).length > 0) {
      await saveSettings({ reminders: remPatch } as Partial<AppSettings>);
    }

    // Payments
    const payPatch: Partial<AppSettings["payments"]> = {};
    if (typeof payments.keksRecipient === "string")
      payPatch.keksRecipient = payments.keksRecipient;
    if (typeof payments.keksTemplate === "string")
      payPatch.keksTemplate = payments.keksTemplate;
    if (typeof payments.revolutUsername === "string")
      payPatch.revolutUsername = payments.revolutUsername;
    if (typeof payments.revolutTemplate === "string")
      payPatch.revolutTemplate = payments.revolutTemplate;
    if (typeof payments.revolutCurrency === "string")
      payPatch.revolutCurrency = payments.revolutCurrency;
    if (payments.defaultMethod === "KEKS Pay" || payments.defaultMethod === "Revolut")
      payPatch.defaultMethod = payments.defaultMethod;
    if (Object.keys(payPatch).length > 0) {
      await saveSettings({ payments: payPatch } as Partial<AppSettings>);
    }

    // Re-resolve and return with masked secrets.
    const fresh = await loadSettings();
    return NextResponse.json({ settings: toClient(fresh) });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to save settings." },
      { status: 500 },
    );
  }
}

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
      "overageMultiplier",
      "overageThresholdKwh",
      "fixedFee",
      "gridFeeRate",
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

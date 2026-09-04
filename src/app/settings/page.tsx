"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { useSettings } from "@/hooks/useSettings";
import { usePush } from "@/hooks/usePush";
import { baselineForModel } from "@/lib/pricing-baseline";
import type { AppSettings } from "@/lib/settings/types";

type TabId = "gmail" | "hepSync" | "storage" | "tariffs" | "semesters" | "notifications" | "homeAssistant" | "reminders" | "payments" | "advanced";

const tabs: { id: TabId; label: string }[] = [
  { id: "gmail", label: "Gmail" },
  { id: "hepSync", label: "HEP sync" },
  { id: "storage", label: "Storage / PDF" },
  { id: "tariffs", label: "Tariffs" },
  { id: "semesters", label: "Semesters" },
  { id: "notifications", label: "Notifications" },
  { id: "homeAssistant", label: "Home Assistant" },
  { id: "reminders", label: "Reminders" },
  { id: "payments", label: "Payments" },
  { id: "advanced", label: "Advanced" },
];

export default function SettingsPage() {
  const { settings, loading, saving, error, save } = useSettings();
  const toast = useToast();
  const [active, setActive] = useState<TabId>("gmail");
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const [testingHa, setTestingHa] = useState(false);
  const [haTestResult, setHaTestResult] = useState<string | null>(null);

  // Local draft initialized from loaded settings.
  const current = draft ?? settings;

  const patchDraft = (fn: (d: AppSettings) => AppSettings) => {
    if (settings) setDraft((d) => fn(d ?? settings));
  };

  const persist = async (patch: Partial<AppSettings>, label = "Settings") => {
    try {
      const updated = await save(patch);
      if (updated) {
        setDraft(updated);
        toast.show("success", `${label} saved.`);
      } else {
        toast.show("warning", `${label} save returned no update.`);
      }
    } catch (err) {
      const e = err as Error;
      console.error(`[settings] save failed: ${e.message}`, e);
      console.error(e.stack);
      toast.show("error", `Failed to save ${label}.`, e.message);
    }
  };

  // Fire a test notification through Home Assistant to verify the bridge.
  const testHaNotification = async () => {
    setTestingHa(true);
    setHaTestResult(null);
    try {
      const res = await fetch("/api/ha/test", { method: "POST" });
      const d = (await res.json()) as {
        sent?: boolean;
        configured?: boolean;
        enabled?: boolean;
        error?: string;
      };
      if (d.sent) {
        setHaTestResult("Sent — check your phone / HA notification.");
        toast.show("success", "Home Assistant test notification sent.");
      } else if (!d.configured) {
        setHaTestResult("Not configured — set the URL and token first.");
        toast.show("warning", "Home Assistant is not configured.");
      } else if (!d.enabled) {
        setHaTestResult("Disabled — enable Home Assistant notifications.");
        toast.show("warning", "Home Assistant notifications are disabled.");
      } else {
        setHaTestResult("Send failed — check HA logs / token.");
        toast.show("error", d.error ?? "Home Assistant send failed.");
      }
    } catch (err) {
      const e = err as Error;
      setHaTestResult("Request failed.");
      toast.show("error", `Test request failed: ${e.message}`);
    } finally {
      setTestingHa(false);
    }
  };

  // "Load model rates": return the given model's baseline tariffs so the
  // editable tariff form can be seeded.
  const modelRates = (model: string): AppSettings["tariffs"] =>
    baselineForModel(model);

  // Persist the selected tariff model (HEP sync setting).
  const setModel = (model: string) =>
    void persist({ hepSync: { ...(settings?.hepSync ?? { tariffModel: "Bijeli" }), tariffModel: model } } as Partial<AppSettings>);

  if (loading && !settings) {
    return (
      <div className="flex items-center gap-2 py-16 text-muted-foreground">
        <Spinner className="size-5" /> Loading settings…
      </div>
    );
  }

  if (!current) {
    return <p className="text-red-600">Could not load settings.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">
          Configure Gmail sync, HEP prices, and storage. Saved to the app DB.
        </p>
      </div>

      <Tabs tabs={tabs} active={active} onActive={(id) => setActive(id as TabId)} />

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {active === "gmail" && (
        <Card>
          <CardHeader
            title="Gmail"
            subtitle="Pull HEP invoices from Gmail and download their PDF attachments."
          />
          <div className="flex flex-col gap-4">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={current.gmail.enabled}
                onChange={(e) => {
                  const v = e.target.checked;
                  patchDraft((d) => ({ ...d, gmail: { ...d.gmail, enabled: v } }));
                  void persist({ gmail: { enabled: v } } as Partial<AppSettings>);
                }}
              />
              Enable Gmail sync
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={current.gmail.autoParse}
                onChange={(e) => {
                  const v = e.target.checked;
                  patchDraft((d) => ({ ...d, gmail: { ...d.gmail, autoParse: v } }));
                  void persist({ gmail: { autoParse: v } } as Partial<AppSettings>);
                }}
              />
              Auto-parse downloaded invoices (store parsed invoice data)
            </label>
            <Field
              label="Client ID"
              value={current.gmail.clientId}
              onChange={(v) =>
                patchDraft((d) => ({ ...d, gmail: { ...d.gmail, clientId: v } }))
              }
              placeholder="Google OAuth client ID"
            />
            <Field
              label="Client secret"
              value={current.gmail.hasClientSecret ? "########" : ""}
              onChange={(v) =>
                patchDraft((d) => ({ ...d, gmail: { ...d.gmail, clientSecret: v } }))
              }
              type="password"
              placeholder={current.gmail.hasClientSecret ? "Stored (enter to replace)" : "Google OAuth client secret"}
            />
            <Field
              label="Poll interval (ms)"
              value={String(current.gmail.pollIntervalMs)}
              type="number"
              min={60000}
              onChange={(v) =>
                patchDraft((d) => ({
                  ...d,
                  gmail: { ...d.gmail, pollIntervalMs: Number(v) },
                }))
              }
              hint="How often the background worker checks Gmail."
            />
            <Field
              label="Gmail query"
              value={current.gmail.query}
              onChange={(v) =>
                patchDraft((d) => ({ ...d, gmail: { ...d.gmail, query: v } }))
              }
              placeholder="from:elektra.racuni-RI@hep.hr has:attachment"
              hint="No is:unread — every matching email is pulled at most once (dedup by message id)."
            />
            <Field
              label="Redirect URI"
              value={current.gmail.redirectUri}
              onChange={(v) =>
                patchDraft((d) => ({ ...d, gmail: { ...d.gmail, redirectUri: v } }))
              }
            />

            {/* Push notifications */}
            <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Push notifications</p>
                  <p className="text-xs text-muted-foreground">
                    Get an alert when a new HEP bill is synced &amp; parsed.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={current.notifications?.enabled ?? false}
                    onChange={(e) => {
                      const v = e.target.checked;
                      patchDraft((d) => ({ ...d, notifications: { ...d.notifications, enabled: v } }));
                      void persist({ notifications: { ...current.notifications, enabled: v } } as Partial<AppSettings>, "Notifications");
                    }}
                  />
                  On
                </label>
              </div>
              <PushSection active={current.notifications?.enabled ?? false} subscribed={current.notifications?.subscribed ?? false} />
            </div>

            <div>
              <Button
                onClick={() =>
                  void persist(
                    { gmail: current.gmail } as Partial<AppSettings>,
                    "Gmail settings",
                  )
                }
                loading={saving}
              >
                Save Gmail settings
              </Button>
            </div>
          </div>
        </Card>
      )}

      {active === "homeAssistant" && (
        <Card>
          <CardHeader
            title="Home Assistant"
            subtitle="Send bill notifications through Home Assistant's notify services."
          />
          <div className="flex flex-col gap-4">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={current.homeAssistant.enabled}
                onChange={(e) => {
                  const v = e.target.checked;
                  patchDraft((d) => ({
                    ...d,
                    homeAssistant: { ...d.homeAssistant, enabled: v },
                  }));
                  void persist({ homeAssistant: { enabled: v } } as Partial<AppSettings>);
                }}
              />
              Enable Home Assistant notifications
            </label>
            <Field
              label="Home Assistant URL"
              value={current.homeAssistant.url}
              onChange={(v) =>
                patchDraft((d) => ({
                  ...d,
                  homeAssistant: { ...d.homeAssistant, url: v },
                }))
              }
              placeholder="http://192.168.1.20:8123"
              hint="Base URL of your Home Assistant instance."
            />
            <Field
              label="Long-Lived Access Token"
              value={current.homeAssistant.token}
              onChange={(v) =>
                patchDraft((d) => ({
                  ...d,
                  homeAssistant: { ...d.homeAssistant, token: v },
                }))
              }
              type="password"
              placeholder={current.homeAssistant.token ? "Stored (enter to replace)" : "HA LLAT token"}
            />
            <Field
              label="Device name"
              value={current.homeAssistant.deviceName}
              onChange={(v) =>
                patchDraft((d) => ({
                  ...d,
                  homeAssistant: { ...d.homeAssistant, deviceName: v },
                }))
              }
              placeholder="sm_s908b, sm_x210"
              hint="Targets notify.mobile_app_<name>. Use a comma-separated list for multiple devices (e.g. sm_s908b, sm_x210)."
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={() =>
                  void persist(
                    { homeAssistant: current.homeAssistant } as Partial<AppSettings>,
                    "Home Assistant settings",
                  )
                }
                loading={saving}
              >
                Save Home Assistant settings
              </Button>
              <Button variant="outline" onClick={() => void testHaNotification()} loading={testingHa}>
                Test notification
              </Button>
              {haTestResult && (
                <span className="text-sm text-muted-foreground">{haTestResult}</span>
              )}
            </div>
          </div>
        </Card>
      )}

      {active === "hepSync" && (
        <Card>
          <CardHeader
            title="HEP sync"
            subtitle="Official tariff price source and baseline fallback."
          />
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">
                Tariff model{" "}
                <span className="text-muted-foreground">
                  (default Bijeli, from your July invoice)
                </span>
              </span>
              <select
                value={current.hepSync.tariffModel}
                onChange={(e) => {
                  const v = e.target.value;
                  patchDraft((d) => ({
                    ...d,
                    hepSync: { ...d.hepSync, tariffModel: v },
                  }));
                }}
                className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {["Bijeli", "Plavi", "Crveni", "Cmi"].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-sm text-muted-foreground">
              Selecting a model only sets which rates are used as the baseline.
              Use the Tariffs tab to view/adjust them, and “Load model rates”
              to populate the tariff form from the chosen model.
            </p>
            <div>
              <Button
                onClick={() =>
                  void persist(
                    { hepSync: current.hepSync } as Partial<AppSettings>,
                    "HEP sync settings",
                  )
                }
                loading={saving}
              >
                Save model
              </Button>
            </div>
          </div>
        </Card>
      )}

      {active === "storage" && (
        <Card>
          <CardHeader
            title="Storage / PDF"
            subtitle="Where downloaded invoice PDFs are kept."
          />
          <div className="flex flex-col gap-4">
            <Field
              label="PDF directory"
              value={current.storage.pdfDir}
              onChange={(v) =>
                patchDraft((d) => ({
                  ...d,
                  storage: { ...d.storage, pdfDir: v },
                }))
              }
            />
            <Field
              label="Inbox directory"
              value={current.storage.inboxDir}
              onChange={(v) =>
                patchDraft((d) => ({
                  ...d,
                  storage: { ...d.storage, inboxDir: v },
                }))
              }
            />
            <div>
              <Button
                onClick={() =>
                  void persist(
                    { storage: current.storage } as Partial<AppSettings>,
                    "Storage settings",
                  )
                }
                loading={saving}
              >
                Save storage settings
              </Button>
            </div>
          </div>
        </Card>
      )}

      {active === "tariffs" && (
        <TariffTab
          tariffs={current.tariffs}
          tariffModel={current.hepSync.tariffModel}
          saving={saving}
          onModelChange={setModel}
          onLoadModel={modelRates}
          onSave={(patch) =>
            void persist(
              { tariffs: { ...current.tariffs, ...patch } } as Partial<AppSettings>,
              "Tariffs",
            )
          }
        />
      )}

      {active === "semesters" && (
        <SemesterTab
          semesters={current.semesters}
          saving={saving}
          onChange={(patch) =>
            patchDraft((d) => ({
              ...d,
              semesters: { ...d.semesters, ...patch },
            }))
          }
          onSave={() =>
            void persist(
              { semesters: current.semesters } as Partial<AppSettings>,
              "Semester cycle",
            )
          }
        />
      )}

      {active === "reminders" && (
        <Card>
          <CardHeader
            title="Reading reminders"
            subtitle="Remind to submit this month's meter counters, via Home Assistant."
          />
          <div className="flex flex-col gap-4">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={current.reminders.enabled}
                onChange={(e) => {
                  const v = e.target.checked;
                  patchDraft((d) => ({
                    ...d,
                    reminders: { ...d.reminders, enabled: v },
                  }));
                }}
              />
              Enable monthly reading reminders
            </label>
            <Field
              label="Remind for days"
              value={String(current.reminders.checkDays)}
              type="number"
              min={1}
              max={10}
              onChange={(v) =>
                patchDraft((d) => ({
                  ...d,
                  reminders: { ...d.reminders, checkDays: Number(v) },
                }))
              }
              hint="From the 1st of the month, check hourly for these many days until a counter reading is entered."
            />
            <div>
              <Button
                onClick={() =>
                  void persist(
                    { reminders: current.reminders } as Partial<AppSettings>,
                    "Reminder settings",
                  )
                }
                loading={saving}
              >
                Save reminder settings
              </Button>
            </div>
          </div>
        </Card>
      )}

      {active === "payments" && (
        <Card>
          <CardHeader
            title="Payments"
            subtitle="Settlement details for KEKS Pay and Revolut used by the pay buttons."
          />
          <div className="flex flex-col gap-4">
            <p className="text-sm font-medium text-foreground">Revolut</p>
            <Field
              label="Revolut.me username"
              value={current.payments.revolutUsername}
              onChange={(v) =>
                patchDraft((d) => ({
                  ...d,
                  payments: { ...d.payments, revolutUsername: v },
                }))
              }
              placeholder="myhandle"
              hint="Used to build https://revolut.me/<username>/… links."
            />
            <Field
              label="Revolut template"
              value={current.payments.revolutTemplate}
              onChange={(v) =>
                patchDraft((d) => ({
                  ...d,
                  payments: { ...d.payments, revolutTemplate: v },
                }))
              }
              placeholder="https://revolut.me/{username}/{currency}{amount}/{note}"
            />
            <Field
              label="Revolut currency code"
              value={current.payments.revolutCurrency}
              onChange={(v) =>
                patchDraft((d) => ({
                  ...d,
                  payments: { ...d.payments, revolutCurrency: v },
                }))
              }
              placeholder="eur"
              hint="e.g. eur, gbp, usd."
            />

            <p className="text-sm font-medium text-foreground">KEKS Pay</p>
            <Field
              label="KEKS Pay recipient"
              value={current.payments.keksRecipient}
              onChange={(v) =>
                patchDraft((d) => ({
                  ...d,
                  payments: { ...d.payments, keksRecipient: v },
                }))
              }
              placeholder="phone or @alias"
              hint="Default recipient/alias used when building the KEKS Pay deep link."
            />
            <Field
              label="KEKS Pay deep-link template"
              value={current.payments.keksTemplate}
              onChange={(v) =>
                patchDraft((d) => ({
                  ...d,
                  payments: { ...d.payments, keksTemplate: v },
                }))
              }
              placeholder="kekspay://pay?amount={amount}&note={note}&recipient={recipient}"
            />

            <div>
              <Button
                onClick={() =>
                  void persist(
                    { payments: current.payments } as Partial<AppSettings>,
                    "Payment settings",
                  )
                }
                loading={saving}
              >
                Save payment settings
              </Button>
            </div>
          </div>
        </Card>
      )}

      {active === "advanced" && (
        <Card>
          <CardHeader title="Advanced" subtitle="Lower-level knobs." />
          <div className="flex flex-col gap-4">
            <Field
              label="Sync log retention"
              value={String(current.advanced.syncLogRetention)}
              type="number"
              min={10}
              onChange={(v) =>
                patchDraft((d) => ({
                  ...d,
                  advanced: { ...d.advanced, syncLogRetention: Number(v) },
                }))
              }
              hint="How many sync log entries to keep."
            />
            <div>
              <Button
                onClick={() =>
                  void persist(
                    { advanced: current.advanced } as Partial<AppSettings>,
                    "Advanced settings",
                  )
                }
                loading={saving}
              >
                Save advanced settings
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function TariffTab({
  tariffs,
  tariffModel,
  saving,
  onSave,
  onLoadModel,
  onModelChange,
}: {
  tariffs: AppSettings["tariffs"];
  tariffModel: string;
  saving: boolean;
  onSave: (patch: Partial<AppSettings["tariffs"]>) => void;
  onLoadModel: (model: string) => AppSettings["tariffs"];
  onModelChange: (model: string) => void;
}) {
  const [draft, setDraft] = useState(tariffs);
  const field = (key: keyof AppSettings["tariffs"], label: string, step: string) => (
    <Field
      label={label}
      value={String(draft[key])}
      type="number"
      step={step}
      onChange={(v) => setDraft((d) => ({ ...d, [key]: Number(v) }))}
    />
  );
  const models = ["Bijeli", "Plavi", "Crveni", "Cmi"];
  return (
    <Card>
      <CardHeader
        title="Tariffs"
        subtitle="HEP energy rates, fees, VAT, and the 3,000 kWh overage rule."
      />
      <div className="mb-4 flex flex-col gap-1">
        <span className="text-sm font-medium">
          Tariff model{" "}
          <span className="text-muted-foreground">(Bijeli is the default, from your invoice)</span>
        </span>
        <select
          value={models.includes(tariffModel) ? tariffModel : "Bijeli"}
          onChange={(e) => {
            const m = e.target.value;
            setDraft(onLoadModel(m));
            onModelChange(m);
          }}
          className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-64"
        >
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Choosing a model fills the rates below; you can still edit any value.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {field("energyRateVt", "Energy rate VT (€/kWh)", "0.0001")}
        {field("energyRateNt", "Energy rate NT (€/kWh)", "0.0001")}
        {field("energyRateJt", "Energy rate JT (€/kWh)", "0.0001")}
        {field("transmissionRate", "Transmission (€/kWh)", "0.0001")}
        {field("distributionRateVt", "Distribution VT (€/kWh)", "0.0001")}
        {field("distributionRateNt", "Distribution NT (€/kWh)", "0.0001")}
        {field("oieRate", "OIE / renewable (€/kWh)", "0.0001")}
        {field("fixedFee", "Supply fee (€/month)", "0.0001")}
        {field("meteringFee", "Metering / OMM (€/month)", "0.0001")}
        {field("vatRate", "VAT rate (0.13 = 13%)", "0.0001")}
        {field("overageThresholdKwh", "Overage threshold (kWh)", "1")}
        {field("overageMultiplier", "Overage multiplier", "0.0001")}
      </div>
      <div className="mt-4">
        <Button
          onClick={() => onSave(draft as Partial<AppSettings["tariffs"]>)}
          loading={saving}
        >
          Save tariffs
        </Button>
      </div>
    </Card>
  );
}

function SemesterTab({
  semesters,
  saving,
  onChange,
  onSave,
}: {
  semesters: AppSettings["semesters"];
  saving: boolean;
  onChange: (patch: Partial<AppSettings["semesters"]>) => void;
  onSave: () => void;
}) {
  const field = (
    key: keyof AppSettings["semesters"],
    label: string,
    min = 1,
    max = 31,
  ) => (
    <Field
      label={label}
      value={String(semesters[key])}
      type="number"
      min={min}
      max={max}
      onChange={(v) => onChange({ [key]: Number(v) } as Partial<AppSettings["semesters"]>)}
    />
  );
  return (
    <Card>
      <CardHeader
        title="Semester cycle"
        subtitle="Define when each 6-month HEP tariff cycle runs. Defaults: Winter Oct 1 – Mar 31, Summer Apr 1 – Sep 30."
      />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold">Winter cycle</h3>
          <div className="grid grid-cols-2 gap-3">
            {field("winterStartDay", "Start day")}
            {field("winterStartMonth", "Start month", 1, 12)}
            {field("winterEndDay", "End day")}
            {field("winterEndMonth", "End month", 1, 12)}
          </div>
        </div>
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold">Summer cycle</h3>
          <div className="grid grid-cols-2 gap-3">
            {field("summerStartDay", "Start day")}
            {field("summerStartMonth", "Start month", 1, 12)}
            {field("summerEndDay", "End day")}
            {field("summerEndMonth", "End month", 1, 12)}
          </div>
        </div>
      </div>
      <div className="mt-4">
        <Button onClick={onSave} loading={saving}>
          Save semester cycle
        </Button>
      </div>
    </Card>
  );
}

/** Web Push subscribe/unsubscribe/test controls used in the Gmail settings tab. */
function PushSection({ active, subscribed }: { active: boolean; subscribed: boolean }) {
  const { busy, supported, isSecure, permission, subscribe, unsubscribe, sendTest } = usePush();

  if (!active) {
    return (
      <p className="text-xs text-muted-foreground">
        Enable notifications to subscribe for new-bill alerts.
      </p>
    );
  }

  if (!supported || !isSecure) {
    return (
      <p className="text-xs text-amber-700">
        Push requires HTTPS (or localhost). This connection is not a secure context, so
        notifications are unavailable here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void (subscribed ? unsubscribe() : subscribe())}
          loading={busy}
        >
          {subscribed ? "Disable notifications" : "Enable notifications"}
        </Button>
        {subscribed && (
          <Button variant="ghost" size="sm" onClick={() => void sendTest()} disabled={busy}>
            Send test
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Permission: {permission} · {subscribed ? "Subscribed" : "Not subscribed"}
      </p>
    </div>
  );
}

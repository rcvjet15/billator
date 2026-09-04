import { env } from "@/lib/env";
import { loadSettings } from "@/lib/settings";
import { logNotificationDelivery } from "@/lib/push/log";

/**
 * Home Assistant notification bridge.
 *
 * This is a server-side, autonomous trigger: the backend sends an HTTP POST to
 * Home Assistant's REST notify service whenever a new bill is synced. It never
 * depends on the frontend UI — the app can even be embedded in HA as an iframe
 * and still fire these notifications.
 *
 * Configuration is resolved with DB-backed settings taking precedence over
 * environment variables:
 *   DB  settings.homeAssistant.url / .token / .deviceName
 *   env HA_URL / HA_TOKEN (device name stays DB-driven or defaults to "phone")
 */

export interface HaNotification {
  title?: string;
  message: string;
  /** Optional HA-compatible extra fields (e.g. data such as click target). */
  data?: Record<string, unknown>;
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** Resolve HA config from settings (DB) with env fallback for url/token. */
async function resolveHaConfig(): Promise<{
  enabled: boolean;
  url: string;
  token: string;
  deviceNames: string[];
} | null> {
  const settings = await loadSettings().catch(() => null);
  const ha = settings?.homeAssistant;

  const url = (ha?.url || "").trim() || env.ha.url;
  const token = (ha?.token || "").trim() || env.ha.token;
  if (!url || !token) return null;

  // Support multiple targets via comma/newline separated device names.
  const deviceNames = (ha?.deviceName || "phone")
    .split(/[,\n]/)
    .map((d) => d.trim())
    .filter(Boolean);

  return {
    enabled: ha?.enabled ?? false,
    url,
    token,
    deviceNames: deviceNames.length ? deviceNames : ["phone"],
  };
}

/**
 * Send a push notification through Home Assistant to each configured device.
 * Best-effort: resolves to false when the integration is disabled, not
 * configured, or no device could be reached. Network/HA errors are logged but
 * never thrown into the sync flow.
 */
export async function sendHaNotification(notification: HaNotification | string): Promise<boolean> {
  const cfg = await resolveHaConfig();
  const message =
    typeof notification === "string" ? notification : notification.message;
  const title = typeof notification === "string" ? undefined : notification.title;

  const log = (ok: boolean, detail?: string) =>
    logNotificationDelivery("home_assistant", {
      ok,
      title,
      message,
      detail,
    });

  if (!cfg) {
    log(false, "home assistant not configured (url/token missing)");
    return false;
  }
  if (!cfg.enabled) {
    log(false, "home assistant disabled");
    return false;
  }

  const data = typeof notification === "string" ? undefined : notification.data;

  const body: Record<string, unknown> = {
    message: truncate(message, 500),
    ...(title ? { title: truncate(title, 255) } : {}),
    ...(data ? { data } : {}),
  };

  let anySent = false;
  let lastErr: string | undefined;
  for (const name of cfg.deviceNames) {
    const device = name.replace(/[^a-zA-Z0-9_]/g, "_");
    const service = `notify/mobile_app_${device}`;
    const endpoint = buildServiceUrl(cfg.url, service);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        anySent = true;
      } else {
        const detail = await res.text().catch(() => "");
        lastErr = `HA responded ${res.status} for ${service}: ${detail}`;
        console.error(`[ha-notify] ${lastErr}`);
      }
    } catch (err) {
      lastErr = `Failed to send to ${service}: ${(err as Error).message}`;
      console.error(`[ha-notify] ${lastErr}`);
    }
  }
  log(anySent, anySent ? undefined : lastErr);
  return anySent;
}

/** Build `POST ${base}/api/services/notify/mobile_app_<name>`. */
function buildServiceUrl(base: string, service: string): string {
  const normalized = base.replace(/\/+$/, "");
  return `${normalized}/api/services/${service}`;
}

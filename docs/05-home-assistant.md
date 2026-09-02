# Billator — Home Assistant Notifications

Billator can push notifications **through Home Assistant's REST API**, so alerts
fire on your phone even though the app itself is embedded in HA via an iframe
(and even if the HA page is accessed remotely through Nabu Casa). The trigger is
**server-side and autonomous** — it does not depend on any browser being open.

## How it works

Home Assistant exposes service calls over a REST API:

```
POST {HA_URL}/api/services/notify/mobile_app_<device>
Authorization: Bearer <HA_TOKEN>
Content-Type:  application/json

{ "title": "...", "message": "...", "data": { ... } }
```

Each installed HA companion app presents a `notify.mobile_app_<name>` service.
Billator calls that for every configured device.

## Code layout

| File | Purpose |
| --- | --- |
| `src/lib/ha/notify.ts` | The core `sendHaNotification()` bridge + config resolution. |
| `src/lib/gmail/sync.ts` | Calls `sendHaNotification()` after a new bill is imported. |
| `src/app/api/ha/test/route.ts` | `POST /api/ha/test` → sends a literal test banner. |
| `src/app/settings/page.tsx` | **Home Assistant** tab — enable, URL, token, devices, Test button. |
| `src/lib/settings/types.ts` | The `homeAssistant` settings group. |
| `src/lib/settings/index.ts` | DB defaults & persistence for those keys. |
| `src/lib/env.ts` | `env.ha.url` / `env.ha.token` env backstops. |

## Configuration

Precedence: **DB settings** (`/settings` → Home Assistant) win; otherwise the
`HA_URL` / `HA_TOKEN` environment variables are used as fallbacks.

| Setting | Key (DB or env) | Meaning |
| --- | --- | --- |
| Enabled flag | `app.homeAssistant.enabled` | master toggle (default `true`) |
| Base URL | `app.homeAssistant.url` or `HA_URL` | e.g. `http://192.168.1.104:8123` |
| Long-Lived token | `app.homeAssistant.token` or `HA_TOKEN` | LLAT (returns masked as `########`) |
| Device(s) | `app.homeAssistant.deviceName` | `notify.mobile_app_<name>`, comma/newline separated for many |

Defaults behind `/settings`:
```text
enabled:  true
url:      http://homeassistant.local:8123
deviceName: (empty -> "phone")
```

> ⚠️ **`<name>.local` mDNS does not resolve inside the Docker container.**
> The Pi's Billator container resolves names via normal DNS, not mDNS, so use
> HA's **IP** in the URL. In the working set that is
> `http://192.168.1.104:8123`. (On the dev Mac, `homeassistant.local` resolves —
> mDNS works there — which is why local tests passed with the `.local` name but
> the Pi's tests failed until switched to the IP.)

## Devices discovered (this environment)

Queried via `GET {HA_URL}/api/services` under `domain == notify`:

- `notify.mobile_app_sm_s908b`
- `notify.mobile_app_sm_x210`
- `notify.lg_webos_tv_49sm8600pla`

So the working `deviceName` is **`sm_s908b, sm_x210`** to notify both phones.

## Sending

### One-shot (test) — `POST /api/ha/test`
```bash
curl -X POST http://<app>/api/ha/test
# → {"ok":true,"sent":true,"configured":true,"enabled":true,"url":"…","deviceName":"…"}
```
The Settings → Home Assistant **Test notification** button calls this and
surfaces which precondition failed (configured?/enabled?/send?) in the UI.

### In code (used by sync)
```ts
import { sendHaNotification } from "@/lib/ha/notify";
await sendHaNotification({
  title: "New HEP bill synced",
  message: "Billed total: €138.68 · Upper floor split: ~€58.78",
  data: { period: "2026-04-01 → 2026-04-30" },
});
```

`sendHaNotification` is best-effort: returns `false` (never throws) if disabled,
mis-configured, or if HA is unreachable; multiple devices are each attempted and
the result is true if any succeeded.

## Automatic trigger

In `src/lib/gmail/sync.ts`, after a **brand-new** invoice is downloaded **and**
parsed, two notifications go out autonomously:

1. **Web Push** (PWA/browser subscribers): title `New HEP bill synced`.
2. **Home Assistant**: same title; the body carries the parsed official
   **grand total** and an **estimated upper-floor split** produced by
   `estimateReadingUpperCost()` (using the reading's stored upper-floor kWh from
   the xlsx and the current tariff). It also attaches the invoice period in
   `data.period`.

Nothing is sent when a sync finds no new bills, and notification failures never
abort the sync.

## Security notes

- The **HA LLAT** is sensitive. It is stored in the DB (not encrypted, unlike
  the Gmail secret). The `/api/settings` route masks it on read (`########`)
  and treats it as write-only.
- A screenshot of the chat may leak the token; after setup, consider regenerating
  it in HA (Profile → Long-Lived Access Tokens).

## Related: making the app iframe into an HTTPS HA page

If HA is served over **HTTPS** (e.g. Nabu Casa), a Billator iframe pointing at a
plain `http://…` URL is blocked as mixed content. Billator must also be HTTPS.
Two ways (see [04-deployment.md](./04-deployment.md)):

- Reverse-proxy Billator with Caddy + a DuckDNS name + Let's Encrypt cert, then
  point the iframe at `https://rcvjetkovic-billator.duckdns.org/`. (Chosen here.)
- Or a LAN-only TLS setup — but that only works while on the same Wi-Fi and
  **cannot** be reached through Nabu Casa, and self-signed certs are rejected in
  an embedded webview.

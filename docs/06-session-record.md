# Billator — Full Session Record

This is a chronological record of every change and discovery made in the long
origin working session, so future sessions and readers can reconstruct *why*
things are the way they are.

---

## Phase 1 — Reconciling & cleaning the readings DB

### Goal
Production Billator at `http://192.168.1.127:3100` (Raspberry Pi, Docker) and
local dev had drifted. We wanted a single, correct set of readings, reconciled
with 6 real HEP PDFs downloaded to `~/Downloads/racun_*.pdf`.

### What we found & fixed around the data import
1. A standalone `.mjs`/`better-sqlite3` importer read the workbook and created
   ~34 monthly rows with `period_start` duplicate-guard.
2. We then decided single months were wrong for periods HEP bills as a
   6-month invoice.
3. **PDF parsing infrastructure fixes** required before production parsing would
   work:
   - `src/lib/parse/polyfill.ts` (`installDomPollyfills()` for
     `DOMMatrix`/`Path2D`/`ImageData`) called from `instrumentation.ts` and
     `parse/hep.ts`.
   - The runner Docker image must ship `pdfjs-dist`'s `pdf.worker.mjs`, which
     Next's standalone tracer under-copies → added an explicit `COPY` in the
     `Dockerfile`.
   - Regenerated `package-lock.json` against the **public** npm registry because
     the Pi cannot reach the internal `artifactory.ib-ci.com`.
4. We cleaned the local `./data/billator.db` (stopping the dev server first so
   its WAL closed), deleted wrong monthly rows, and ended with a small set of
   six-month or monthly rows.

### The readings-table "reason" bug
Users saw **"missing upper-floor"** on rows that had **no invoice** at all. Root
cause: the status logic treated any `hep_vt_kwh`/`hep_nt_kwh` (meter kWh) as
proof of an invoice. Fixed so that "has invoice" means actual billed money
(`hep_grand_total`/`hep_total_supply`/`hep_fees`) or a linked `source_pdf_id`:

- UI: `incompleteReason()` in `src/app/readings/page.tsx`.
- Storage status recompute: `sqlite-adapter.ts`, `filesystem-adapter.ts`,
  `supabase-adapter.ts` (`computeReadingStatus` / `computeSupabaseStatus`).

Result: a manual xlsx-only row now honestly reports **"missing invoice"** instead
of "missing upper-floor".

---

## Phase 2 — The big data-model correction

### Discovery (the painful, pivotal one)
The master Excel workbook `Struja Potrošnja.xlsx` contains **only the
upper-floor submeter**, NOT the whole house. Earlier steps had:

- **Imported the upper-floor readings into the HEP (`hep_*`) fields** — wrong.
- Built 6-month "sums" from a **mis-mapped** Excel row order (serial month
  numbers repeat across years) — wrong numbers, wrong months.

After extensive investigation (and confirming via DuckDNS-independent checks),
the fix was:

1. Read the workbook's monthly `Razlika` (delta) columns for the **upper floor**.
2. Get the **whole-house** values from the **HEP invoice PDFs** instead
   (using each invoice's `Distribucija` consumption lines, which the regex
   parser was under-reading for the big 6-month invoices).
3. Rebuild all readings with **HEP = invoice** and **Upper = summed xlsx deltas**
   over the same window.

Key sanity heuristic used to catch mistakes: an upper-floor submeter can never
be larger than the whole-house meter for the same window. One such check flagged
an under-parsed invoice (the parser returned ~⅓ of the real distribution kWh);
cross-reading the invoice text gave the correct totals.

### Final data model / current production readings (9 rows)

| Period | HEP VT/NT (invoice) | Upper VT/NT (xlsx) | Invoice € |
| --- | --- | --- | --- |
| 2024-03-01 → 2024-08-31 | 2930 / 2002 | 1212.2 / 1148.3 | 708.61 |
| 2024-09-01 → 2025-02-28 | 4156 / 3735 | 2661.3 / 1583.2 | 1226.26 |
| 2025-03-01 → 2025-08-31 | 3342 / 2395 | 1546.3 / 1350.1 | 925.76 |
| 2025-09-07 → 2025-09-30 | 248 / 127 | 202.2 / 101.3 | 72.48 |
| 2025-11-01 → 2026-03-31 | 5539 / 4583 | 3572.7 / 2667.5 | 1798.65 |
| 2026-04-01 → 2026-04-30 | 475 / 403 | 170 / 202.7 | 138.68 |
| 2026-05-01 → 2026-05-31 | 480 / 343 | 117 / 126.3 | 134.83 |
| 2026-06-01 → 2026-06-30 | 603 / 341 | 291 / 163.9 | 157.89 |
| 2026-07-01 → 2026-07-31 | 0 / 0 (no invoice yet) | 345 / 276.6 | 0 |

All synced to the Pi's `billator.db`.

### April's odd value
`2026-04` originally showed VT **6637.61**, which turned out to be a cumulative
meter reading, not a monthly delta. Re-parsed `racun_109013595385.pdf` → correct
monthly **VT 474.94 / NT 403.18** (total €138.68). Fixed in DB.

### Validating upper split vs the Excel `Ukupno` price
For Apr–Jul the app's per-reading `upperCost` closely matches the Excel `Ukupno €`
column. Example check (April: upper VT 170 / NT 202.7): app ≈ €58.78 vs Excel
€57.21. Residual difference = the app adds a proportional share of the **fixed
supply + metering fees** (Opskrba/OMM) which the Excel `Ukupno` column omits.
May matched to the cent; the mapping is correct.

---

## Phase 3 — Home Assistant notifications module (new feature)

### Request
The backend should trigger **notifications autonomously through Home Assistant**,
because the UI is embedded in HA via an iframe.

### Implementation
1. HA settings group added across:
   - `src/lib/settings/types.ts` — `HomeAssistantSettings` (`enabled`, `url`,
     `token`, `deviceName`).
   - `src/lib/settings/index.ts` — defaults (`enabled: true`, default URL) +
     load/save.
   - `/api/settings` route — PUT accepts it; GET masks the token.
   - `src/app/settings/page.tsx` — new **Home Assistant** tab + **Save** and the
     **Test notification** button/handler.
   - `src/lib/env.ts` — `HA_URL` / `HA_TOKEN` fallbacks.
2. **Core bridge** `src/lib/ha/notify.ts` — `sendHaNotification()` that POSTs to
   `{url}/api/services/notify/mobile_app_<device>` for one or more devices
   (device names may be comma/newline separated).
3. **Test endpoint** `src/app/api/ha/test/route.ts` → literal test message; the
   UI button shows explicit feedback (configured/enabled/sent).
4. **Wiring** in `src/lib/gmail/sync.ts` — after a genuinely new parsed bill, it
   sends the **grand total** and an estimated **upper split** (via
   `estimateReadingUpperCost()`) plus the period in `data`.

### Live testing / discoveries
- HA is at LAN IP **192.168.1.104**, reachable at `homeassistant.local:8123`
  from the Mac (mDNS) but **not** from inside the Docker container (no mDNS) →
  so on the Pi the HA URL **must be the IP**, not `.local`.
- The LLAT must come from HA (Profile → Long-Lived Access Token).
- Enumerating `GET {HA_URL}/api/services` revealed the device services:
  `mobile_app_sm_s908b`, `mobile_app_sm_x210`,
  `lg_webos_tv_49sm8600pla`. The default `phone` does **not** exist.
- Final deviceName: **`sm_s908b, sm_x210`** → both phones receive alerts.
- Verified `POST /api/ha/test` → `sent:true` from the **Pi container** after
  switching the URL to the IP.

### HTTPS/is-iframed problem
The HA **Android app** refused to load the Billator iframe because HA is HTTPS
(Nabu Casa) and a plain `http://` iframe is blocked as mixed content. Solution:
serve Billator over HTTPS (see this session's Caddy/DuckDNS work, or
[04-deployment.md](./04-deployment.md)).

---

## Phase 4 — Public HTTPS exposure (Caddy + DuckDNS)

### Goal
Expose Billator over HTTPS so the HA iframe works from anywhere (including
through Nabu Casa while away from home).

### Steps & findings
1. **Caddy** (systemd on the Pi, ports 80/443) already serves Grafana at
   `rcvjetkovic-grafana.duckdns.org` → `localhost:3000`.
2. Added a second site to `/etc/caddy/Caddyfile`:
   ```
   rcvjetkovic-billator.duckdns.org { reverse_proxy localhost:3100 { … headers … } }
   ```
   Validate + reload. Caddy auto-issued a Let's Encrypt cert (it fell back to
   tls-alpn-01 when http-01 timed out on port 80).
3. **DuckDNS** runs as an add-on on the HA node and points subdomains at the
   Pi's public IP `93.136.149.168` (the same IP `rcvjetkovic-grafana` uses).
   - ⚠️ DuckDNS **cannot create** a new subdomain via API/add-on. The update
     returns `KO` and DNS reports **NXDOMAIN** until the subdomain is created in
     the duckdns.org **web dashboard**. Once created, the add-on (or a manual
     `curl .../update?domains=...token=...`) returns `OK` and the A record
     appears.
   - The origin dev machine sits behind a **corporate proxy** that:
     blocks `duckdns.org`, and also fakes a **503** / rewrite to a corporate IP
     for public DuckDNS hosts. Validate from the Pi or via DNS-over-HTTPS, not
     from the filtered dev box.
4. End state: `https://rcvjetkovic-billator.duckdns.org/` resolves to
   `93.136.149.168`, Caddy holds a valid cert for it, and it reverse-proxies to
   the Billator container on host port 3100.

---

## Helper notes

- **Deploy:** `./scripts/deploy.sh` (rsync + `docker compose up --build -d`,
  `BILLATOR_PORT=3100`). Config read from gitignored `.env.deploy`.
- **Edit the Pi DB:** stop the container, checkpoint the WAL
  (`PRAGMA wal_checkpoint(TRUNCATE)`), edit/copy `billator.db`, restart. Failing
  to stop first can surface `SQLITE_READONLY`.
- **Reaching the services while you're not on the home Wi-Fi:** the LAN IPs
  (192.168.1.x) are only reachable from inside the LAN. Use the public HTTPS
  URL / Nabu Casa from outside.
- Regulatory names you may meet: Croatia's energy operator is HEP
  (`elektra.racuni-RI@hep.hr` for e-invoices). "RVT" = VT (day) and "RNT" = NT
  (night) tariffs.

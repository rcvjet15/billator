# Billator — Features

Billator is a Next.js single-page-app style site (App Router) with these pages:
`/` (Dashboard), `/readings`, `/readings/new`, `/readings/[id]`,
`/readings/edit/[id]`, `/split`, `/sync`, `/settings`, plus many `/api/*` routes.

## Dashboard — `/`

- Shows the headline **ground-floor** and **upper-floor** cost for the current
  semester, so the two parties see "what I owe".
- Lists the individual semester-block contributions with kWh and share.
- Links into the detailed `/split` calculator.

## Readings — `/readings`

- **Table** of every stored reading (sorted, filterable).
- Columns include the period, **HEP Volt/Kilowatt (VT/NT)** kWh, invoice money,
  **Upper VT/NT** kWh, an estimated **"Upper split"** amount, and origin.
- The **status column** explains *why* a row is not complete:
  `no data yet` / `missing invoice` / `missing upper-floor` (see business-logic).
- **New** — `/readings/new`: add a reading from scratch, or **upload a HEP PDF**
  to pre-fill the form (powered by the parser below). You can enter invoice
  (HEP) **and/or** the upper-floor monitor values.
- **Detail** — `/readings/[id]`: full breakdown of one reading; shows a
  **Download PDF** button when the reading is linked to a stored source PDF.
- **Edit** — `/readings/edit/[id]`: change any metric; status is recomputed.

## Split — `/split`

The main deliverable: pick/advance a **winter** or **summer** semester and get
the fair money split of that HEP cycle.

- Reads all readings that touch the chosen 6-month semester block, prorating
  any that straddle the boundary.
- Computes the running semester total and flags whether the **3,000 kWh**
  threshold was crossed.
- Reports, per floor, the **consumption share**, **base energy cost**,
  **penalty/overage cost**, **fixed-fee share**, and a final **grand total owed**.
- The upper-floor number here is what can be pushed to a phone/Home Assistant.

## Sync (Gmail) — `/sync`

Background Gmail integration that pulls HEP invoice PDFs automatically:

- Polls Gmail for the configured query
  (`from:elektra.racuni-RI@hep.hr has:attachment`).
- Downloads each new invoice attachment into the **inbox** (`/sync` page lists
  them), marks the email read, dedups by Gmail message id.
- Optionally **auto-parses** PDFs into invoice fields.
- Shows sync history/log rows.
- Triggered on an interval (background worker) and by hand from this page.

## Settings — `/settings`

A tabbed panel (8 tabs). All of it is stored DB-driven; nothing here needs a
code change:

1. **Gmail** — enable, OAuth client id/secret, poll interval, query, auto-parse,
   redirect URI. Also the Web-Push enable switch.
2. **HEP sync** — which tariff model baseline ("Bijeli" etc.).
3. **Storage / PDF** — inbox/PDF directories (server-side).
4. **Tariffs** — energy/distribution/transmission/OIE rates, fixed & metering
   fees, overage multiplier + threshold, VAT.
5. **Semesters** — winter/summer date ranges.
6. **Notifications** — Web Push master enable + subscribe/unsubscribe/test.
7. **Home Assistant** — enable, HA URL, Long-Lived Access Token, device(s);
   a **Test notification** button.
8. **Advanced** — sync-log retention.

## Notifications

Two independent channels, both triggered autonomously **server-side** when the
Gmail worker imports a genuinely-new bill:

- **Web Push (PWA)** — to subscribed browsers. Requires HTTPS (or localhost).
- **Home Assistant** — POST to your HA `notify/mobile_app_*` service(s) with the
  bill **grand total** and the computed **upper-floor split amount**.

See [05-home-assistant.md](./05-home-assistant.md).

## Inbox & download

- The API exposes an inbox of stored PDFs with download and
  "create reading from this PDF" actions.

## PWA

- Installable (manifest, icons) so it behaves like an app and can receive
  **Web Push** in a secure context.

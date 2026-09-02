# Billator — Architecture & Stack

## 1. Stack

| Area | Choice |
| --- | --- |
| Framework | **Next.js 16** (`^16.3.1`) — App Router, `src/` layout, `output: standalone` |
| UI | **React 19**, **TypeScript 5**, **Tailwind CSS 4**, shadcn-style components |
| Tests | **Vitest** (`npm test` / `vitest run`) |
| DB | **SQLite** via `better-sqlite3` (default); also has filesystem & Supabase adapters |
| Migrations | none needed — schema is created idempotently in the sqlite adapter |
| Other libs | `googleapis` (Gmail), `pdf-parse`/`pdfjs-dist` (HEP PDFs), `xlsx`
            (one-off CLI importer), `web-push` (Web Push), `lucide-react` icons |
| Path alias | `@/*` → `./src/*` |

## 2. Directory layout

```text
src/
  app/                  # App Router pages + API route handlers
    page.tsx (/)        # dashboard
    readings/           # list, new, [id].detail, edit
    split/page.tsx      # the semester split calculator UI
    sync/page.tsx       # Gmail sync + history
    settings/page.tsx   # settings UI (tabs incl. Home Assistant)
    api/
      readings/route.ts & readings/[id]      # readings CRUD
      split/calculate/route.ts               # POST -> SplitResult
      gmail/  (auth, auth/callback, status, sync)
      inbox/  (list, download, create-reading, clear-msg, [id])
      parse/hep/route.ts                     # POST upload PDF -> parse prefill
      push/   (subscribe, unsubscribe, test, public-key)
      ha/test/route.ts                       # POST -> fire HA test notification
      settings/route.ts                      # GET/PUT settings (secrets masked)
      sync/logs/route.ts
      health/route.ts
  lib/
    env.ts                # typed access to process.env (incl. VAPID, HA_URL/HA_TOKEN)
    settings/index.ts, types.ts   # DB-backed settings load/save + defaults
    config-service.ts, default-config.ts  # tariff baseline + override merge
    storage-service.ts    # singleton facade -> full adapter-tree below
    storage/
      abstract-storage.ts # StorageAdapter interface
      sqlite-adapter.ts   # better-sqlite3 (used in prod)
      filesystem-adapter.ts
      supabase-adapter.ts
    calc/                 # business engine (types, semester, config, bill,
                          # delta, groupReadings, readingCost)
    parse/hep.ts + polyfill.ts          # PDF field extraction
    gmail/  (client.ts, sync.ts, worker.ts)   # the background Gmail poller
    push/   (send.ts)                   # Web Push
    ha/     (notify.ts)                 # Home Assistant notify bridge
    security/secret.ts    # AES encrypt/decrypt of Gmail secrets at rest
    api.ts                # small client wrapper used by the frontend
  hooks/           # useReadings, useSettings, usePush, ...
  components/      # ui/* and layout components
  utils/           # dates (proration/semesters), format, cn
```

## 3. Storage layer (adapter pattern)

`StorageService` is a singleton that selects an adapter from `STORAGE_MODE`
(`sqlite` | `filesystem` | `supabase`). In production it is SQLite. Every
adapter implements the same `StorageAdapter` interface for readings, settings,
inbox PDFs and sync logs, so switching backends is a config change.

SQLite specifics:

- A single file `billator.db`, path from `DB_PATH` (default `./data/billator.db`).
- On startup the adapter creates/migrates the `readings`, `settings`,
  `inbox_pdfs` and `sync_logs` tables (idempotent).
- Uses SQLite **WAL**. ⚠️ Because of buffered WAL commits, external reads of the
  file can look stale; always checkpoint
  (`PRAGMA wal_checkpoint(TRUNCATE)`) after stopping the app before copying it
  (see Deployment).

## 4. Business engine (`src/lib/calc`)

Pure, unit-tested TypeScript:

- `semester.ts` — the semester split: prorated aggregation, running total,
  threshold/overage, attribution across VT/NT, per-floor cost + penalty.
- `readingCost.ts` — a lighter **per-reading** upper-cost estimate used on the
  readings grid and in notifications (does **not** include the semester penalty).
- `groupReadings.ts`, `delta.ts`, `bill.ts` — helpers/splitting of cumulative
  meter reads (Start/End → delta), cent-rounding, etc.
- `types.ts` — shared `Reading`, `TariffConfig`, `SemesterResult`, etc.

## 5. PDF parsing (`src/lib/parse`)

`parse/hep.ts` uses `pdf-parse` (pdfjs-dist) to pull text and regex-parse HEP
fields: period, per-tariff kWh, cumulative meter reads, and the € totals
(supply, fees, grand total). **Confidence is always 0–1 and never blocks the UI**:
whatever it finds pre-fills a manual form you can correct.

Standalone/container gotchas (fixed in the repo):

- pdf.js needs DOM polyfills (`DOMMatrix`, `Path2D`, `ImageData`) — installed by
  `installDomPollyfills()` (`parse/polyfill.ts`) from `instrumentation.ts`.
- The pdf worker (`pdf.worker.mjs`) is loaded at runtime and is **copied** into
  the Docker runner image explicitly (see Dockerfile).
- `next.config.ts` keeps `pdf-parse` as a server external package.

## 6. Gmail sync engine (`src/lib/gmail`)

- `worker.ts` — a background poller (`setInterval`) gated by
  `settings.gmail.enabled`, started once per process. On a new invoice it
  downloads PDFs and (if `autoParse`) parses them.
- `sync.ts` — one sync pass; downloads attachments, registers inbox records,
  marks emails read, dedups by Gmail message id, writes `sync_logs`. After a
  successful new-import it fires **notifications**: Web Push and, new in this
  session, Home Assistant (see [05-home-assistant.md](./05-home-assistant.md)).

## 7. Settings & secrets

- App settings are DB-backed (`app.*` keys) and edited via `/settings`. The
  server-side model is `AppSettings` (`src/lib/settings/types.ts`) with groups:
  `gmail`, `hepSync`, `storage`, `tariffs`, `semesters`, `notifications`,
  `homeAssistant`, `advanced`.
- The `/api/settings` route masks secrets on read (Gmail client secret and the
  HA LLAT shown as `########`) and treats them as write-only on save.
- **Gmail client secret is encrypted at rest** with AES using
  `GMAIL_ENCRYPTION_KEY` (`src/lib/security/secret.ts`). The **HA token** is
  stored plaintext in settings (as is the HA URL), consistent with other
  non-Gmail tokens.

## 8. Environment variables

Everything goes through `src/lib/env.ts`. The important ones:

| Variable | Purpose |
| --- | --- |
| `STORAGE_MODE` | `sqlite` (default) / `filesystem` / `supabase` |
| `DB_PATH` | SQLite file (container sets `/app/data/billator.db`) |
| `GMAIL_ENCRYPTION_KEY` | AES key for Gmail secrets (>=16 chars) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push |
| `HA_URL`, `HA_TOKEN` | Home Assistant fallback override (DB settings take priority) |
| `PORT`, `HOSTNAME` | Next.js server bind (container uses 3000 / 0.0.0.0) |
| `NEXT_PUBLIC_SUPABASE_URL`, `...KEY` | optional secondary backend |

## 9. Notifications overview

Two code paths send notifications on a new bill:

1. **Web Push** — `sendPush()` in `src/lib/push/send.ts` POSTs to a stored VAPID
   browser subscription. Requires a secure context.
2. **Home Assistant** — `sendHaNotification()` in `src/lib/ha/notify.ts` POSTs to
   HA's REST `notify/mobile_app_<device>` service with the grand total and an
   estimated upper split. Triggered from `src/lib/gmail/sync.ts`.

Both are fire-and-forget and swallow errors so a broken notification never fails
the sync.

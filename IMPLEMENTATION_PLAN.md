# Billator — Implementation Plan

## Goal
A web app to split Croatian electricity (HEP) bills between two floors of a house, tracking the rolling 6-month, 3,000 kWh semi-annual tariff threshold rule.

## Stack & Architecture
- **Next.js 16 (App Router)** · React 19 · TypeScript · Tailwind 4 · Vercel hosting · Supabase/Postgres · Vitest.
- **Structure mirrors kika-dario-bikes** conventions: `src/lib` with `env.ts` + storage-service singleton + adapter-pattern storage, section-based components, skeleton loading, shadcn-style HSL design tokens — adapted to the App Router.

## Key Decisions (confirmed)
1. **Router/tooling:** Next 16 App Router with `src/` layout; `@/*` alias → `./src/*`.
2. **PDFs:** Numbers only — uploaded invoice is used to *parse* the data, the file is **not** persisted (no blob adapter).
3. **History:** Full month-by-month readings are stored; semester totals are computed on the fly from stored rows (no fragile stored counter).
4. **HEP tariffs:** Defaults in `lib/calc/config.ts`, overridable via env + a `tariff_config` DB row (mirrors reference `config-service` + `default-config` pattern).
5. **Penalty split:** The 35% overage penalty cost is split **proportionally** to each floor's share of **cumulative semester consumption to date** (not a static 50/50), so varying monthly usage is reflected.
6. **Straddling periods:** A billing period that crosses a semester boundary (e.g. Mar 15–Apr 15) is **proportionally prorated** into the two blocks by days (a `dates.ts` util, unit-tested).
7. **Parse robustness:** `lib/parse/hep.ts` exposes **regex-parsing stubs** backed by a **manual prefill form**, so an imperfect OCR read can never block the workflow (layout varies: regular slips vs final-account bills).
8. **Build order:** Engine-first; `/split` UI first, then `/readings`, then `/` dashboard, then optional `/tariffs`.

## Folder structure
```
src/
  app/                     # App Router
    layout.tsx  page.tsx  globals.css
    api/
      health/route.ts
      readings/route.ts            # GET list / POST create
      readings/[id]/route.ts       # GET / PUT / DELETE
      split/calculate/route.ts     # POST -> split result
    tariffs/  # optional settings view (v1: env-only)
  lib/
    env.ts                 # centralized env + feature flags
    config-service.ts      # merge defaults + DB/env override
    default-config.ts      # tariff defaults (rates, 35%, 3000, fees, vat)
    storage-service.ts     # singleton getInstance()
    storage/
      abstract-storage.ts  # StorageAdapter: readings CRUD + tariff + semester query
      supabase-adapter.ts  # Postgres primary
      filesystem-adapter.ts# local dev fallback (STORAGE_MODE=filesystem)
    calc/
      types.ts  semester.ts  config.ts
    parse/hep.ts           # invoice field extraction stubs
    api.ts                 # client wrapper for route handlers
  utils/dates.ts           # semester-block membership incl. straddling periods
  hooks/                   # useReadings, useSplit, useTariffConfig
  components/
    layout/    # Header, Footer, PageShell
    ui/        # Card, Button, Input, Select, Badge, Stat, Table, Skeleton, ProgressBar
    split/     # SplitBreakdown, PenaltyCard, FloorResultCard, SemesterBanner
    readings/  # ReadingForm, ReadingList, ReadingRow
```

## Data model (Postgres)
- **readings** (one row per billing period):
  - `id`, `period_start`, `period_end`
  - HEP: `hep_vt_kwh`, `hep_nt_kwh`, `hep_total_supply`, `hep_fees`, `hep_grand_total`
  - Upper floor monitor: `upper_vt_kwh`, `upper_nt_kwh`
  - `created_at`, `updated_at`
- **tariff_config** (single editable row / env):
  - `energy_rate_vt`, `energy_rate_nt`, `overage_multiplier` (= 1.35), `overage_threshold_kwh` (= 3000), `fixed_fee`, `grid_fee_rate`, `vat_rate`

## Core engine — `lib/calc/semester.ts`
1. **Semester block membership** — assign billing periods to Winter (Oct 1–Mar 31) or Summer (Apr 1–Sep 30); split straddling periods across blocks.
2. **Straddling proration** (`utils/dates.ts`, unit-tested) — a billing period crossing a semester boundary (e.g. Mar 15–Apr 15) is apportioned to each block **proportional to the number of days** that fall in each block, preserving total kWh (VT and NT separately).
3. **Running 6-month total** — aggregate block readings (incl. prorated splits); flag when cumulative **3,000 kWh** is crossed and report the overage amount.
4. **35% penalty** — apply the higher rate to the energy component above the threshold within the block.
5. **Split logic**:
   - Ground floor consumption = HEP total − upper-floor monitor readings (upper extends from the ground/floor-one main meter).
   - Both floors priced at the base tariff for their share (VT + NT).
   - **Overage penalty cost split proportionally** to each floor's share of **cumulative semester consumption up to the current point** (not static 50/50), so it tracks varying monthly usage month-to-month.
   - Fixed costs (monthly fees, grid/network fees, VAT) split between floors.
   - Output: per-floor VT/NT base energy cost, penalty share, fixed-cost share, total owed; plus semester running total and the threshold-crossing flag/amount.

## API routes (Route Handlers)
- `api/readings` CRUD — monthly reading create/list/get/update/delete.
- `api/split/calculate` — `POST` → runs `semester.ts` → returns split result (incl. straddle-prorated semester totals + proportional penalty split).
- `api/health` — health check.

## UI / Pages (order: /split → /readings → /)
1. **`/split`** (priority — surfaces the crucial engine output):
   - Semester banner (block + date range), running-total progress bar vs 3,000 with over-threshold warning.
   - **Penalty card**: 35% overage amount + note that it's split proportionally to usage.
   - **Per-floor result cards**: VT/NT base energy, penalty share, fixed-cost share, total owed.
   - "Recalculate" button → `api/split/calculate`.
2. **`/readings`**:
   - Add-month form: billing period dates, HEP VT/NT + amounts/fees, upper-floor VT/NT. Upload input parses the PDF/photo to prefill fields (file not saved).
   - **Robust manual entry**: regex-parsing stubs in `lib/parse/hep.ts` attempt extraction (handles regular slips *and* final-account layouts); the user can always edit/prefill every field manually, so an imperfect OCR read never blocks data entry.
   - Editable/deletable list → `api/readings`.
3. **`/` dashboard** (light): SemesterTracker (running total vs 3,000), MonthlySummary for both floors, RecentReadings, quick actions to `/split` and `/readings`.
4. *(Optional/later)* **`/tariffs`** settings view to edit the `tariff_config` DB override (v1 can be env-only).

## Tests (Vitest)
- `dates.test.ts` — semester block membership; boundary dates (Oct 1 / Mar 31 / Sep 30); **straddling-period proration** (e.g. Mar 15–Apr 15 split by days; VT and NT kept separate); whole-period-inside-block cases.
- `semester.test.ts` — running semester totals (incl. prorated straddle splits), crossing at **exactly 3,000** vs **above 3,000**, 35% on excess across VT and NT, **proportional penalty split varying by cumulative monthly usage** (not static 50/50), fixed-cost split, edge cases (zero consumption, whole month over threshold).
- `tariffs.test.ts` — default/config merge and env/DB override behavior.
- `parse/hep.test.ts` — regex stubs match regular slip and final-account layouts; safe degradation when OCR text is imperfect (returns partial candidates for manual prefill).

## Tooling & config (mirror reference conventions)
- `tsconfig.json` (alias → `./src/*`, add Vitest types), `next.config.ts`, Tailwind/PostCSS config, `eslint.config.mjs`, `.env.template`.
- Add Vitest dev dependency + `"test": "vitest run"`.

## Verification
`vitest` → `eslint` → `next build` / `tsc --noEmit`.

## Build order
1. Reshape scaffold to Next 16 + `src/` layout + tooling.
2. Engine + types + dates (incl. straddle proration) + tests (calc foundation).
3. Storage adapters + config-service + route handlers + client hooks.
4. `src/lib/api.ts` + `hooks/` + `parse/hep.ts` (regex stubs).
5. UI: **`/split`** first, then `/readings` (with robust manual-prefill form), then `/` dashboard.
6. Verify all (tests + lint + build) — ensure straddle-proration, proportional-penalty, and parser-degradation cases all pass.

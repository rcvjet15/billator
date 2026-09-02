# Billator — Business Logic

## 1. The problem it solves

A two-floor house shares **one HEP electricity connection** (single metering
point, e.g. `1200250544`). HEP bills the whole house on one meter, but the two
floors (ground and upper) are inhabited by different parties that want to split
the cost fairly.

HEP adds a subtlety: it bills on **6-month rolling cycles** and charges a 35%
penalty on any consumption above **3,000 kWh inside a cycle**. So the correct
split isn't a simple 50/50 of the invoice amount — it depends on **how much each
floor consumed during the semester**, because a heavy-user floor pushes the
whole house over the threshold.

## 2. Two data sources (important — they were conflated early on)

Every reading in Billator is built from **two independent meters**:

| Field group | Source | Meaning |
| --- | --- | --- |
| `hep_vt_kwh`, `hep_nt_kwh`, invoice totals | **HEP invoice PDF** (downloaded from Gmail, or parsed from a file) | The whole-house meter + official billed amounts. |
| `upper_vt_kwh`, `upper_nt_kwh` | A **hand-kept Excel sheet** ("upper-floor") | A separate **submeter** on the upper floor. |

Critical clarification learned the hard way in the origin session:

- The master Excel workbook (`Struja Potrošnja.xlsx`, sheet `2024`) tracks
  **only the upper-floor submeter**. Its `VT KWh`/`NT KWh` columns are cumulative
  meter states; the **`VT KWh Razlika` / `NT KWh Razlika`** columns are the
  **monthly deltas** = that month's upper-floor consumption.
- HEP invoice PDFs give the **whole-house** consumption.
- The xlsx only provides **upper-floor data**; it must **not** be mistaken for
  whole-house kWhe. Every cell's monetary columns (E/P/D/oie/PDV/`UKUPNO €`) are
  that upper-floor row's computed cost.

Because an upper floor's submeter can never exceed the whole-house meter, when a
derived upper value looked larger than the paired HEP value it signalled a bug
(see [06-session-record.md](./06-session-record.md) — a parser under-read the
6-month invoice consumption).

## 3. Semesters and the tariff

HEP/HEP-Ops uses tiered household tariffs over two named 6-month cycles:

- **Winter** — Oct 1 → Mar 31.
- **Summer** — Apr 1 → Sep 30.

A **semester threshold** of **3,000 kWh** applies per cycle. Consumption within
the threshold is billed at the base rate; consumption **above** it is treated as
"overage" and billed at a **35% premium** (`overageMultiplier = 1.35`).

These cycle dates are configurable (`src/lib/settings/types.ts`) and the 
tariff's numbers (rates, threshold, multipliers, fixed fees, VAT) come from a
DB row / env overrides over the defaults in
`src/lib/default-config.ts` / `src/lib/calc/config.ts`.

## 4. Data model: readings

A **reading** is one entity for one billing period and carries both meters:

```text
period_start, period_end          e.g. 2024-03-01 .. 2024-08-31
HEP (whole house, from invoice):  hep_vt_kwh, hep_nt_kwh,
                                  hep_total_supply, hep_fees, hep_grand_total
                                  (+ optional cumulative hep_start/end_vt/nt)
Upper floor (from xlsx):          upper_vt_kwh, upper_nt_kwh
                                  (+ optional upper_start/end_vt/nt)
status (pending | complete), origin (parsed | manual),
created_at, updated_at
```

Readings may span months or even a whole HEP semester (HEP often issues one
6-month invoice). Billator stores them at that invoice granularity.

### Real readings (as of the session end)

Below are the 9 readings in the DB after the fix. `HEP` = whole-house invoice
kWh; `Upper` = summed upper-floor daily deltas for the same window.

| Period | HEP VT / NT (invoice) | Upper VT / NT (xlsx) | invoice total € |
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

## 5. Reading "completeness" status

Billator derives two independent conditions per reading and reports them in the
readings table:

- **Has an invoice** = actual billed money exists (`hep_grand_total`,
  `hep_total_supply`, or `hep_fees` above 0) **or** the reading links a source
  PDF. Meter kWh alone (`hep_vt_kwh`/`hep_nt_kwh`) is *not* treated as an
  invoice (a meter read is not a bill).
- **Has upper-floor data** = `upper_vt_kwh` or `upper_nt_kwh` > 0.

The list shows human-friendly **reasons** a reading is incomplete:

| Condition | Label |
| --- | --- |
| No consumption **and** no upper **and** no invoice | `no data yet` |
| Consumption/upper present but no invoice money or PDF | `missing invoice` |
| Invoice present but no upper-floor figures | `missing upper-floor` |
| Otherwise, both present | (complete) |

This logic lives in `src/app/readings/page.tsx` and is mirrored as the
`pending/complete` status computed in each storage adapter.

## 6. Splitting a semester

Given the readings that touch a semester block, Billator:

1. **Prorates** every reading into the block by days
   (`src/utils/dates.ts` works on `2026-03-21`-style strings). A reading
   straddling a semester boundary (e.g. 2026-03-20 → 2026-04-10) contributes
   only its in-block portion.
2. **Accumulates** whole-house kWhe (winter vs summer fraction), and separately
   the upper-floor kWhe.
3. **Tracks a running semester total.** The moment cumulative HEP consumption
   crosses `3,000 kWh`, the excess becomes **overage** and grows 1-for-1 to the
   end of the cycle.
4. **Attributes the overage** across the VT and NT tariff lines in proportion to
   each line's share of total consumption that semester.
5. **Bills each floor** with base energy rate on its own in-threshold kWhe and
   penalty pricing on the overage it causes — split **proportionally** by each
   floor's share of cumulative consumption (not a static 50/50).
6. **Adds fixed fees** (monthly supply `0.982` + metering `1.983`), distribution,
   transmission and OIE, then **VAT (13%)** on the base.

The per-floor result is surfaced as the **ground-floor cost** and the
**upper-floor cost** for the selected semester candidate.

The engine is `src/lib/calc/semester.ts` with helpers in
`src/lib/calc/readingCost.ts`, `groupReadings.ts`, `bill.ts`, `delta.ts`, and is
covered by a full unit suite.

## 7. Billing periods vs calendar

Root docs (IMPLEMENTATION_PLAN.md) describe a month-by-month model. The shipped
version keys readings to **invoice periods**, which for this HEP set are 6-month
windows or single months depending on how HEP issued them. Semester totals are
always recomputed from the readings on demand — nothing is stored as a running
counter, so historical edits stay correct.

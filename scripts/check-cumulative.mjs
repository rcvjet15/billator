#!/usr/bin/env node
/**
 * Check Billator's readings for cumulative-counter consistency.
 *
 * Going forward the README/engine treats the odometer counter values
 * (hep_end_vt, hep_end_nt, upper_end_vt, upper_end_nt) as the authoritative
 * source for monthly consumption (delta = end - previous end). This script
 * walks the readings chronologically and reports, per channel:
 *   - missingCumulative : no counter end recorded (row carries only derived kWh)
 *   - reset             : an end dropped below its predecessor (meter reset/wrap)
 *   - revised           : stored hepVtKwh/hepNtKwh/... differs from the re-derived delta
 *
 * It is read-only by default and never edits the DB unless --apply is given.
 * Historical rows imported from invoices/xlsx usually have no counters and are
 * simply reported as missingCumulative (that is expected).
 *
 * Usage:
 *   node scripts/check-cumulative.mjs [db_path] [--apply]
 */
import Database from "better-sqlite3";
import { existsSync } from "node:fs";

const dbPath = process.argv.find((a) => /\.db$/.test(a)) || "./data/billator.db";
const apply = process.argv.includes("--apply");

if (!existsSync(dbPath)) {
  console.error("DB not found:", dbPath);
  process.exit(1);
}
const db = new Database(dbPath);

const rows = db
  .prepare("SELECT id, period_start, period_end, hep_end_vt, hep_end_nt, upper_end_vt, upper_end_nt, hep_vt_kwh, hep_nt_kwh, upper_vt_kwh, upper_nt_kwh FROM readings ORDER BY period_start")
  .all();

const r3 = (n) => Math.round((n + Number.EPSILON) * 1000) / 1000;

function channel(reading, endKey, kwhKey, prevEnd) {
  const end = reading[endKey] === null ? undefined : reading[endKey];
  const stored = Number(reading[kwhKey] ?? 0);
  if (end === undefined) return { missing: true, reset: false, revised: false, delta: stored };
  let delta;
  let reset = false;
  if (prevEnd !== undefined) {
    if (end < prevEnd) { reset = true; delta = r3(end); }
    else delta = r3(end - prevEnd);
  } else {
    delta = 0; // baseline
  }
  const revised = Math.abs(delta - stored) > 0.0005;
  return { missing: false, reset, revised, delta };
}

let prev = { hepVt: undefined, hepNt: undefined, upperVt: undefined, upperNt: undefined };
let missing = 0, resets = 0, revised = 0, total = 0;
const report = [];

for (const r of rows) {
  total += 1;
  const hepVt = channel(r, "hep_end_vt", "hep_vt_kwh", prev.hepVt);
  const hepNt = channel(r, "hep_end_nt", "hep_nt_kwh", prev.hepNt);
  const upperVt = channel(r, "upper_end_vt", "upper_vt_kwh", prev.upperVt);
  const upperNt = channel(r, "upper_end_nt", "upper_nt_kwh", prev.upperNt);

  const flags = [];
  if (hepVt.missing || hepNt.missing || upperVt.missing || upperNt.missing) { missing++; flags.push("MISSING-CUMULATIVE"); }
  if (hepVt.reset || hepNt.reset || upperVt.reset || upperNt.reset) { resets++; flags.push("RESET"); }
  if (hepVt.revised || hepNt.revised || upperVt.revised || upperNt.revised) { revised++; flags.push("REVISED"); }

  if (flags.length) {
    report.push({
      period: `${r.period_start} → ${r.period_end}`,
      flags,
      detail: {
        hepVt: { end: r.hep_end_vt, stored: r.hep_vt_kwh, delta: hepVt.delta },
        hepNt: { end: r.hep_end_nt, stored: r.hep_nt_kwh, delta: hepNt.delta },
        upperVt: { end: r.upper_end_vt, stored: r.upper_vt_kwh, delta: upperVt.delta },
        upperNt: { end: r.upper_end_nt, stored: r.upper_nt_kwh, delta: upperNt.delta },
      },
    });
  }

  // Advance predecessors only for counters that exist.
  if (r.hep_end_vt !== null) prev.hepVt = r.hep_end_vt;
  if (r.hep_end_nt !== null) prev.hepNt = r.hep_end_nt;
  if (r.upper_end_vt !== null) prev.upperVt = r.upper_end_vt;
  if (r.upper_end_nt !== null) prev.upperNt = r.upper_end_nt;

  if (apply && (hepVt.revised || hepNt.revised || upperVt.revised || upperNt.revised)) {
    db.prepare("UPDATE readings SET hep_vt_kwh=?, hep_nt_kwh=?, upper_vt_kwh=?, upper_nt_kwh=?, updated_at=datetime('now') WHERE id=?")
      .run(hepVt.delta, hepNt.delta, upperVt.delta, upperNt.delta, r.id);
  }
}

console.log(`Readings checked: ${total}`);
console.log(`  missing cumulative counter (expected for invoice-only history): ${missing}`);
console.log(`  potential meter resets: ${resets}`);
console.log(`  consumption would change (revised${apply ? " · applied" : ""}): ${revised}`);
for (const rep of report) {
  console.log(`\n[${rep.flags.join(", ")}] ${rep.period}`);
  console.log(" ", JSON.stringify(rep.detail));
}
db.close();

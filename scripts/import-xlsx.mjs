#!/usr/bin/env node
/**
 * Import the "Struja Potrošnja" XLSX (HEP consumption history) into Billator's
 * SQLite DB directly. Self-contained (no tsx / no project alias needed).
 *
 * The sheet tracks the HEP main meter's cumulative VT/NT reads per month
 * (cols B/C) plus monthly deltas (cols E/F). Rows are mapped forward
 * month-by-month starting at the given start year/month (default 2024/01*),
 * with the year rolling over after December. Only rows with a real monthly
 * delta are imported; opening/reset rows are skipped.
 *
 * Usage:
 *   node scripts/import-xlsx.mjs "~/Downloads/Struja Potrošnja.xlsx" <db> [startYear] [startMonth]
 *   e.g.
 *   node scripts/import-xlsx.mjs ~/Downloads/Struja.xlsx ./data/billator.db 2024 1
 */
import XLSX from "xlsx";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";

function num(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate();
}
function pad(n) {
  return String(n).padStart(2, "0");
}
function rowIsMonthly(row) {
  const dVt = num(row[4]) ?? 0;
  const dNt = num(row[5]) ?? 0;
  const hasCum = num(row[1]) !== undefined || num(row[2]) !== undefined;
  // opening/header/reset rows: no real positive monthly delta from a previous read
  if (dVt < 0) return false; // meter reset
  if (dVt === 0 && dNt === 0 && !hasCum) return false;
  return true;
}

async function main() {
  const file = process.argv[2];
  const dbPath = process.argv[3];
  const startYear = Number(process.argv[4] ?? 2024);
  const startMonth = Number(process.argv[5] ?? 1);
  if (!file || !dbPath) {
    console.error("Usage: import-xlsx.mjs <file.xlsx> <dbPath> [startYear] [startMonth]");
    process.exit(1);
  }
  if (!existsSync(file)) {
    console.error("File not found:", file);
    process.exit(1);
  }

  const wb = XLSX.readFile(file);
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  // Existing periods so we don't create duplicates (a reading already exists).
  const existing = new Set(
    db.prepare("SELECT period_start FROM readings").all().map((r) => r.period_start),
  );

  const insert = db.prepare(`
    INSERT OR IGNORE INTO readings (
      id, period_start, period_end, hep_vt_kwh, hep_nt_kwh, hep_total_supply,
      hep_fees, hep_grand_total, upper_vt_kwh, upper_nt_kwh,
      source_pdf_id, source_pdf_name, created_at, updated_at,
      status, origin, hep_start_vt, hep_end_vt, hep_start_nt, hep_end_nt,
      upper_start_vt, upper_end_vt, upper_start_nt, upper_end_nt
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  let year = startYear;
  let month = startMonth;
  let prevCumVt;
  let prevCumNt;
  let created = 0;
  let skipped = 0;
  let now = new Date().toISOString();

  const tx = db.transaction(() => {
    for (const row of json) {
      const label = row[0];
      if (label === undefined || label === null || label === "Mjesec") continue;

      const cumVt = num(row[1]);
      const cumNt = num(row[2]);
      const dVt = num(row[4]) ?? 0;
      const dNt = num(row[5]) ?? 0;

      if (!rowIsMonthly(row)) {
        console.log(`  · skip ${label} (opening/reset)`);
        if (cumVt !== undefined) prevCumVt = cumVt;
        if (cumNt !== undefined) prevCumNt = cumNt;
        skipped += 1;
        continue;
      }

      const periodStart = `${year}-${pad(month)}-01`;
      const periodEnd = `${year}-${pad(month)}-${pad(daysInMonth(year, month))}`;
      const hepStartVt = prevCumVt ?? cumVt;
      const hepEndVt = cumVt;
      const hepStartNt = prevCumNt ?? cumNt;
      const hepEndNt = cumNt;

      if (existing.has(periodStart)) {
        console.log(`  · ${periodStart} already exists (kept existing reading)`);
        skipped += 1;
        prevCumVt = hepEndVt;
        prevCumNt = hepEndNt;
        month += 1;
        if (month > 12) { month = 1; year += 1; }
        continue;
      }

      insert.run(
        randomUUID(), periodStart, periodEnd,
        dVt, dNt, 0, 0, 0, 0, 0,
        null, null, now, now,
        "pending", "manual",
        hepStartVt, hepEndVt, hepStartNt, hepEndNt,
        null, null, null, null,
      );
      existing.add(periodStart);
      console.log(`  ✓ ${periodStart} | VT ${dVt} (${hepStartVt ?? "-"}->${hepEndVt ?? "-"}) NT ${dNt}`);
      created += 1;

      prevCumVt = hepEndVt;
      prevCumNt = hepEndNt;

      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
  });

  tx();
  console.log(`\nImport to ${dbPath} done: created ${created}, skipped ${skipped}.`);
  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

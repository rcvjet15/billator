/**
 * Migrate an existing filesystem `data/store.json` (old default) into the
 * SQLite DB. Safe to run more than once (idempotent per reading id).
 *
 * Usage: node scripts/migrate-filesystem-to-sqlite.js [sourceJson] [dbPath]
 * Defaults: data/store.json -> data/billator.db
 */
import { readFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const source = process.argv[2] || path.join(process.cwd(), "data", "store.json");
const dbFile = process.argv[3] || path.join(process.cwd(), "data", "billator.db");

let state;
try {
  state = JSON.parse(readFileSync(source, "utf8"));
} catch {
  console.log(`No source file at ${source} — nothing to migrate.`);
  process.exit(0);
}

mkdirSync(path.dirname(dbFile), { recursive: true });
const db = new Database(dbFile);

// Ensure schema exists
db.exec(`
  CREATE TABLE IF NOT EXISTS readings (
    id TEXT PRIMARY KEY,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    hep_vt_kwh REAL NOT NULL DEFAULT 0,
    hep_nt_kwh REAL NOT NULL DEFAULT 0,
    hep_total_supply REAL NOT NULL DEFAULT 0,
    hep_fees REAL NOT NULL DEFAULT 0,
    hep_grand_total REAL NOT NULL DEFAULT 0,
    upper_vt_kwh REAL NOT NULL DEFAULT 0,
    upper_nt_kwh REAL NOT NULL DEFAULT 0,
    source_pdf_id TEXT, source_pdf_name TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);

const insert = db.prepare(`
  INSERT OR IGNORE INTO readings
    (id, period_start, period_end, hep_vt_kwh, hep_nt_kwh, hep_total_supply,
     hep_fees, hep_grand_total, upper_vt_kwh, upper_nt_kwh,
     source_pdf_id, source_pdf_name, created_at, updated_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`);

const tx = db.transaction((readings) => {
  for (const r of readings) {
    insert.run(
      r.id, r.periodStart, r.periodEnd, r.hepVtKwh, r.hepNtKwh,
      r.hepTotalSupply, r.hepFees, r.hepGrandTotal, r.upperVtKwh, r.upperNtKwh,
      r.sourcePdfId ?? null, r.sourcePdfName ?? null,
      r.createdAt, r.updatedAt,
    );
  }
});

const readings = state.readings || [];
tx(readings);

// Migrate tariff config
if (state.tariffConfig) {
  const insertSetting = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value
  `);
  const m = {
    energyRateVt: "tariff.energyRateVt",
    energyRateNt: "tariff.energyRateNt",
    overageMultiplier: "tariff.overageMultiplier",
    overageThresholdKwh: "tariff.overageThresholdKwh",
    fixedFee: "tariff.fixedFee",
    gridFeeRate: "tariff.gridFeeRate",
    vatRate: "tariff.vatRate",
  };
  for (const [k, sk] of Object.entries(m)) {
    if (state.tariffConfig[k] !== undefined) {
      insertSetting.run(sk, String(state.tariffConfig[k]));
    }
  }
}

console.log(`Migrated ${readings.length} readings into ${dbFile}`);
db.close();

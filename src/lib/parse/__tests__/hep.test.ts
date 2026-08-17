import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { parseHepInvoice } from "@/lib/parse/hep";

describe("parseHepInvoice against the real July 2026 invoice", () => {
  const text = readFileSync("examples/july-invoice.txt", "utf8");

  it("extracts the billing period", () => {
    const r = parseHepInvoice(text);
    expect(r.periodStart).toBe("2026-07-01");
    expect(r.periodEnd).toBe("2026-07-31");
  });

  it("extracts VT/NT kWh from the meter-reading section", () => {
    const r = parseHepInvoice(text);
    expect(r.hepVtKwh).toBeCloseTo(649.51, 2);
    expect(r.hepNtKwh).toBeCloseTo(388.45, 2);
  });

  it("extracts the grand total from UKUPAN IZNOS RAČUNA (not the section ukupno)", () => {
    const r = parseHepInvoice(text);
    expect(r.hepGrandTotal).toBeCloseTo(193.6, 2);
  });

  it("extracts the energy supply total", () => {
    const r = parseHepInvoice(text);
    expect(r.hepTotalSupply).toBeCloseTo(157.3, 2);
  });

  it("extracts the renewable incentive fee", () => {
    const r = parseHepInvoice(text);
    expect(r.hepFees).toBeCloseTo(13.74, 2);
  });

  it("detects the >3.000 kWh overage billed this period", () => {
    const r = parseHepInvoice(text);
    expect(r.hepOverageKwh).toBeCloseTo(428, 2);
  });
});

describe("parseHepInvoice robustness (edge case #3)", () => {
  it("degrades gracefully on unrelated text", () => {
    const r = parseHepInvoice("totally unrelated words no figure anywhere");
    expect(r.confidence).toBe(0);
    expect(r.hepVtKwh).toBeUndefined();
    expect(r.hepNtKwh).toBeUndefined();
    expect(r.hepGrandTotal).toBeUndefined();
  });

  it("never throws on empty or undefined input", () => {
    expect(() => parseHepInvoice("")).not.toThrow();
    expect(() => parseHepInvoice(undefined as unknown as string)).not.toThrow();
  });

  it("handles dot-decimal (1,234.56) style amounts", () => {
    const text = "UKUPAN IZNOS RAČUNA 1,234.56 EUR";
    const r = parseHepInvoice(text);
    expect(r.hepGrandTotal).toBeCloseTo(1234.56, 2);
  });
});

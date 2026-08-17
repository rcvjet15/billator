"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import { parseHepInvoice } from "@/lib/parse/hep";
import type { HepParseResult } from "@/lib/parse/hep";
import type { ReadingInput } from "@/lib/calc/types";

interface ReadingFormProps {
  onSubmit: (input: ReadingInput) => Promise<unknown>;
}

const empty: ReadingInput = {
  periodStart: "",
  periodEnd: "",
  hepVtKwh: 0,
  hepNtKwh: 0,
  hepTotalSupply: 0,
  hepFees: 0,
  hepGrandTotal: 0,
  upperVtKwh: 0,
  upperNtKwh: 0,
};

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Manual data-entry form with a best-effort HEP parse to prefill fields. The
 * PDF / pasted-text parse is only a starting point — every value stays
 * editable, so an imperfect parse never blocks data entry (edge case #3).
 */
export function ReadingForm({ onSubmit }: ReadingFormProps) {
  const [form, setForm] = useState<ReadingInput>(empty);
  const [rawText, setRawText] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof ReadingInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const setNum =
    (k: keyof ReadingInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: num(e.target.value) }));

  const applyParseResult = (r: HepParseResult) => {
    setForm((f) => ({
      ...f,
      periodStart: r.periodStart ?? f.periodStart,
      periodEnd: r.periodEnd ?? f.periodEnd,
      hepVtKwh: r.hepVtKwh ?? f.hepVtKwh,
      hepNtKwh: r.hepNtKwh ?? f.hepNtKwh,
      hepTotalSupply: r.hepTotalSupply ?? f.hepTotalSupply,
      hepFees: r.hepFees ?? f.hepFees,
      hepGrandTotal: r.hepGrandTotal ?? f.hepGrandTotal,
    }));
  };

  const handleParseText = () => {
    applyParseResult(parseHepInvoice(rawText));
  };

  const handleParsePdf = async () => {
    if (!pdfFile) return;
    setParsing(true);
    setError(null);
    try {
      const { result } = await api.parseHepPdf(pdfFile);
      applyParseResult(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setParsing(false);
    }
  };

  const reset = () => {
    setForm(empty);
    setRawText("");
    setPdfFile(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.periodStart || !form.periodEnd) {
      setError("Billing period dates are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(form);
      reset();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {/* Prefill from PDF or pasted text (numbers only; file is not stored) */}
      <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
            className="text-sm text-muted-foreground"
            aria-label="Upload HEP PDF"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={parsing}
            disabled={!pdfFile}
            onClick={handleParsePdf}
          >
            Prefill from PDF
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm text-muted-foreground" htmlFor="ocr">
            …or paste invoice text to prefill:
          </label>
          <textarea
            id="ocr"
            rows={2}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Paste extracted invoice text…"
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div>
            <Button type="button" variant="ghost" size="sm" onClick={handleParseText}>
              Prefill from text
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Billing period */}
        <div>
          <label className="text-sm font-medium">Period start</label>
          <Input type="date" value={form.periodStart} onChange={set("periodStart")} />
        </div>
        <div>
          <label className="text-sm font-medium">Period end</label>
          <Input type="date" value={form.periodEnd} onChange={set("periodEnd")} />
        </div>
      </div>

      <fieldset className="grid grid-cols-3 gap-4 rounded-lg border border-border p-4">
        <legend className="px-2 text-sm font-medium">HEP meter (main build)</legend>
        <div>
          <label className="text-sm font-medium">VT kWh</label>
          <Input type="number" min="0" step="0.1" value={form.hepVtKwh} onChange={setNum("hepVtKwh")} />
        </div>
        <div>
          <label className="text-sm font-medium">NT kWh</label>
          <Input type="number" min="0" step="0.1" value={form.hepNtKwh} onChange={setNum("hepNtKwh")} />
        </div>
        <div>
          <label className="text-sm font-medium">Supply (EUR)</label>
          <Input type="number" min="0" step="0.01" value={form.hepTotalSupply} onChange={setNum("hepTotalSupply")} />
        </div>
        <div>
          <label className="text-sm font-medium">Fees (EUR)</label>
          <Input type="number" min="0" step="0.01" value={form.hepFees} onChange={setNum("hepFees")} />
        </div>
        <div>
          <label className="text-sm font-medium">Grand total (EUR)</label>
          <Input type="number" min="0" step="0.01" value={form.hepGrandTotal} onChange={setNum("hepGrandTotal")} />
        </div>
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-4 rounded-lg border border-border p-4">
        <legend className="px-2 text-sm font-medium">Upper floor monitor</legend>
        <div>
          <label className="text-sm font-medium">VT kWh</label>
          <Input type="number" min="0" step="0.1" value={form.upperVtKwh} onChange={setNum("upperVtKwh")} />
        </div>
        <div>
          <label className="text-sm font-medium">NT kWh</label>
          <Input type="number" min="0" step="0.1" value={form.upperNtKwh} onChange={setNum("upperNtKwh")} />
        </div>
      </fieldset>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div>
        <Button type="submit" loading={saving}>
          Save reading
        </Button>
      </div>
    </form>
  );
}

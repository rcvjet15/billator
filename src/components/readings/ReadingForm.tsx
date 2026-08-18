"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import { parseHepInvoice } from "@/lib/parse/hep";
import type { HepParseResult } from "@/lib/parse/hep";
import type { ReadingInput, InboxPdf } from "@/lib/calc/types";

interface ReadingFormProps {
  onSubmit: (input: ReadingInput) => Promise<unknown>;
  /** When provided, this form edits/continues an existing reading. */
  initial?: { id: string } & ReadingInput;
  onUpdate?: (id: string, input: Partial<ReadingInput>) => Promise<unknown>;
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

/** Build a ReadingInput for the form from an existing reading (drops the id). */
function stripInitial(initial: { id: string } & ReadingInput): ReadingInput {
  const rest = { ...initial };
  delete (rest as { id?: string }).id;
  return {
    periodStart: rest.periodStart ?? "",
    periodEnd: rest.periodEnd ?? "",
    hepVtKwh: rest.hepVtKwh ?? 0,
    hepNtKwh: rest.hepNtKwh ?? 0,
    hepTotalSupply: rest.hepTotalSupply ?? 0,
    hepFees: rest.hepFees ?? 0,
    hepGrandTotal: rest.hepGrandTotal ?? 0,
    upperVtKwh: rest.upperVtKwh ?? 0,
    upperNtKwh: rest.upperNtKwh ?? 0,
    ...(rest.sourcePdfId ? { sourcePdfId: rest.sourcePdfId, sourcePdfName: rest.sourcePdfName } : {}),
  };
}

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Manual data-entry form with a best-effort HEP parse to prefill fields. The
 * PDF / pasted-text parse is only a starting point — every value stays
 * editable, so an imperfect parse never blocks data entry (edge case #3).
 */
export function ReadingForm({ onSubmit, initial, onUpdate }: ReadingFormProps) {
  const [form, setForm] = useState<ReadingInput>(() =>
    initial ? stripInitial(initial) : empty,
  );
  const [rawText, setRawText] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inbox, setInbox] = useState<InboxPdf[]>([]);
  const [sourcePdfId, setSourcePdfId] = useState<string | undefined>(
    initial?.sourcePdfId,
  );

  // Load the invoice inbox (downloaded PDFs) to pick from.
  useEffect(() => {
    api
      .listInbox()
      .then((res) => setInbox(res.inbox))
      .catch(() => undefined);
  }, []);

  const set = (k: keyof ReadingInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const setNum =
    (k: keyof ReadingInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: num(e.target.value) }));

  const applyParseResult = (
    r: HepParseResult,
    source?: { id: string; name: string },
  ) => {
    setSourcePdfId(source?.id);
    setForm((f) => ({
      ...f,
      periodStart: r.periodStart ?? f.periodStart,
      periodEnd: r.periodEnd ?? f.periodEnd,
      hepVtKwh: r.hepVtKwh ?? f.hepVtKwh,
      hepNtKwh: r.hepNtKwh ?? f.hepNtKwh,
      hepTotalSupply: r.hepTotalSupply ?? f.hepTotalSupply,
      hepFees: r.hepFees ?? f.hepFees,
      hepGrandTotal: r.hepGrandTotal ?? f.hepGrandTotal,
      ...(source
        ? { sourcePdfId: source.id, sourcePdfName: source.name }
        : {}),
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

  /** Parse a downloaded inbox PDF (fetched from the local API) and prefill. */
  const handleParseInbox = async (item: InboxPdf) => {
    setParsing(true);
    setError(null);
    try {
      const res = await fetch(`/api/inbox/${item.id}/download`);
      if (!res.ok) throw new Error("Could not fetch inbox PDF.");
      const blob = await res.blob();
      const file = new File([blob], item.filename, { type: "application/pdf" });
      const { result } = await api.parseHepPdf(file);
      applyParseResult(result, { id: item.id, name: item.filename });
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
    setSourcePdfId(undefined);
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
      if (initial && onUpdate) {
        // Editing an existing reading — only send changed/added fields so we
        // don't wipe out data entered on another day.
        await onUpdate(initial.id, form);
      } else {
        await onSubmit(form);
      }
      reset();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {/* Pick a downloaded invoice PDF from the Gmail inbox to parse */}
      {inbox.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <span className="text-sm font-medium">From your invoice inbox</span>
          <div className="flex flex-wrap gap-2">
            {inbox.map((item) => (
              <Button
                key={item.id}
                type="button"
                variant={sourcePdfId === item.id ? "primary" : "outline"}
                size="sm"
                onClick={() => void handleParseInbox(item)}
                loading={parsing && sourcePdfId === item.id}
              >
                {item.filename}
              </Button>
            ))}
          </div>
          {sourcePdfId && (
            <span className="text-xs text-muted-foreground">
              Review the values below, then save. Source: {form.sourcePdfName}
            </span>
          )}
        </div>
      )}

      {/* Prefill from PDF or pasted text (numbers only; file is not stored) */}
      <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted">
            <input
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
              aria-label="Choose HEP PDF"
            />
            <FileText className="size-4" />
            {pdfFile ? pdfFile.name : "Choose PDF"}
          </label>
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
          <Input type="number" min="0" step="0.0001" value={form.hepVtKwh} onChange={setNum("hepVtKwh")} />
        </div>
        <div>
          <label className="text-sm font-medium">NT kWh</label>
          <Input type="number" min="0" step="0.0001" value={form.hepNtKwh} onChange={setNum("hepNtKwh")} />
        </div>
        <div>
          <label className="text-sm font-medium">Supply (EUR)</label>
          <Input type="number" min="0" step="0.0001" value={form.hepTotalSupply} onChange={setNum("hepTotalSupply")} />
        </div>
        <div>
          <label className="text-sm font-medium">Fees (EUR)</label>
          <Input type="number" min="0" step="0.0001" value={form.hepFees} onChange={setNum("hepFees")} />
        </div>
        <div>
          <label className="text-sm font-medium">Grand total (EUR)</label>
          <Input type="number" min="0" step="0.0001" value={form.hepGrandTotal} onChange={setNum("hepGrandTotal")} />
        </div>
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-4 rounded-lg border border-border p-4">
        <legend className="px-2 text-sm font-medium">Upper floor monitor</legend>
        <div>
          <label className="text-sm font-medium">VT kWh</label>
          <Input type="number" min="0" step="0.0001" value={form.upperVtKwh} onChange={setNum("upperVtKwh")} />
        </div>
        <div>
          <label className="text-sm font-medium">NT kWh</label>
          <Input type="number" min="0" step="0.0001" value={form.upperNtKwh} onChange={setNum("upperNtKwh")} />
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

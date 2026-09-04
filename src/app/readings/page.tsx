"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Eye, FileText, Pencil, Trash2, Wallet } from "lucide-react";

import { Button, Spinner } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable, type DataTableColumn, type DataTableFilter } from "@/components/ui/DataTable";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PaymentModal, type PaymentModalTarget } from "@/components/payments/PaymentModal";
import { api } from "@/lib/api";
import { useReadings } from "@/hooks/useReadings";
import { useSettings } from "@/hooks/useSettings";
import { formatDate, formatDateWithTime, formatEur, formatKwh } from "@/utils/format";
import type { Reading } from "@/lib/calc/types";

/** Why a reading is incomplete (mirrors the status computation). */
function incompleteReason(r: Reading): string {
  // "Invoice" means billed monetary data (from the HEP bill). Consumption
  // (VT/NT kWh) alone is just the meter read, not proof an invoice exists.
  const hasInvoice =
    Number(r.hepTotalSupply) > 0 ||
    Number(r.hepFees) > 0 ||
    Number(r.hepGrandTotal) > 0 ||
    Boolean(r.sourcePdfId);
  const hasUpper = Number(r.upperVtKwh) > 0 || Number(r.upperNtKwh) > 0;
  const hasConsumption = Number(r.hepVtKwh) > 0 || Number(r.hepNtKwh) > 0;
  if (!hasConsumption && !hasUpper && !hasInvoice) return "no data yet";
  if (!hasInvoice) return "missing invoice";
  if (!hasUpper) return "missing upper-floor";
  return "incomplete";
}

interface SyncResultPopup {
  ok: boolean;
  found: boolean;
  status: string;
  files: string[];
  lastEmail?: {
    messageId: string;
    subject?: string;
    from?: string;
    date?: string;
    wasParsed: boolean;
  };
  error?: string;
}

export default function ReadingsPage() {
  const { readings, loading, error, remove } = useReadings();
  const { settings } = useSettings();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResultPopup | null>(null);
  const [payTarget, setPayTarget] = useState<PaymentModalTarget | null>(null);

  // Whether we can run the auto-parse sync: Gmail configured+enabled and
  // automatic parsing enabled.
  const canAutoParse = !!(
    settings?.gmail.enabled &&
    settings?.gmail.clientId &&
    settings?.gmail.hasClientSecret &&
    settings?.gmail.autoParse
  );

  const runSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const { outcome } = await api.runGmailSync();
      setSyncResult({
        ok: outcome.ok,
        found: outcome.found,
        status: outcome.status,
        files: outcome.files,
        lastEmail: outcome.lastEmail,
      });
    } catch (err) {
      const e = err as Error;
      console.error(`[readings] sync failed: ${e.message}`, e);
      console.error(e.stack);
      setSyncResult({ ok: false, found: false, status: "Sync failed", files: [], error: e.message });
    } finally {
      setSyncing(false);
    }
  };

  const columns: DataTableColumn<Reading>[] = useMemo(
    () => [
      {
        key: "period",
        header: "Period",
        sortValue: (r) => r.periodStart,
        render: (r) => (
          <span className="whitespace-nowrap">
            {formatDate(r.periodStart)} → {formatDate(r.periodEnd)}
          </span>
        ),
      },
      { key: "vt", header: "VT", sortValue: (r) => r.hepVtKwh, render: (r) => formatKwh(r.hepVtKwh) },
      { key: "nt", header: "NT", sortValue: (r) => r.hepNtKwh, render: (r) => formatKwh(r.hepNtKwh) },
      {
        key: "upperVt",
        header: "Upper VT",
        sortValue: (r) => r.upperVtKwh,
        render: (r) => formatKwh(r.upperVtKwh),
        hideBelow: "md",
      },
      {
        key: "upperNt",
        header: "Upper NT",
        sortValue: (r) => r.upperNtKwh,
        render: (r) => formatKwh(r.upperNtKwh),
        hideBelow: "md",
      },
      {
        key: "amount",
        header: "Amount",
        sortValue: (r) => r.hepGrandTotal,
        render: (r) => formatEur(r.hepGrandTotal),
      },
      {
        key: "upperCost",
        header: "Upper split",
        sortValue: (r) => r.upperCost ?? 0,
        render: (r) => (r.upperCost != null ? formatEur(r.upperCost) : "—"),
        hideBelow: "md",
      },
      {
        key: "created",
        header: "Created",
        sortValue: (r) => r.createdAt,
        render: (r) => <span className="whitespace-nowrap">{formatDateWithTime(r.createdAt)}</span>,
        hideBelow: "md",
      },
      {
        key: "origin",
        header: "Source",
        sortValue: (r) => r.origin ?? "",
        render: (r) =>
          r.origin === "parsed" ? (
            <Badge tone="info">parsed</Badge>
          ) : (
            <Badge>manual</Badge>
          ),
      },
      {
        key: "status",
        header: "Status",
        sortValue: (r) => r.status ?? "",
        render: (r) => {
          if (r.status === "complete") {
            return <Badge tone="success">complete</Badge>;
          }
          return (
            <Badge tone="warning">
              {incompleteReason(r)}
            </Badge>
          );
        },
      },
      {
        key: "actions",
        header: "Actions",
        render: (r) => (
          <div className="flex items-center gap-1">
            {Number(r.upperCost) > 0 && (
              <IconButton
                label="Pay upper share"
                icon={<Wallet className="size-4" />}
                onClick={() =>
                  setPayTarget({ reading: r, amount: Number(r.upperCost) })
                }
              />
            )}
            <Link href={`/readings/${r.id}`}>
              <IconButton label="Details" icon={<Eye className="size-4" />} />
            </Link>
            {r.sourcePdfId && (
              <a href={`/api/inbox/${r.sourcePdfId}/download`} target="_blank" rel="noopener noreferrer">
                <IconButton label="Download PDF" icon={<FileText className="size-4" />} />
              </a>
            )}
            <Link href={`/readings/edit/${r.id}`}>
              <IconButton label="Edit" icon={<Pencil className="size-4" />} />
            </Link>
            <IconButton
              label="Delete"
              tone="danger"
              icon={<Trash2 className="size-4" />}
              onClick={() => {
                if (window.confirm(`Delete reading ${formatDate(r.periodStart)} → ${formatDate(r.periodEnd)}?`)) {
                  void remove(r.id);
                }
              }}
            />
          </div>
        ),
      },
    ],
    [remove],
  );

  const filters: DataTableFilter<Reading>[] = useMemo(() => {
    const list: DataTableFilter<Reading>[] = [];
    if (from) list.push({ key: "period", test: (r) => r.periodStart >= from });
    if (to) list.push({ key: "period", test: (r) => r.periodStart <= to });
    return list;
  }, [from, to]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Monthly readings</h1>
          <p className="text-muted-foreground">
            Each month&apos;s HEP invoice and upper-floor monitor values. Invoice and monitor readings can be
            entered on different days.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => void runSync()} loading={syncing} disabled={!canAutoParse} title={canAutoParse ? "Run Gmail sync & auto-parse" : "Enable Gmail sync + auto-parse in Settings"}>
            Run sync & auto-parse
          </Button>
          <Link href="/readings/new">
            <Button>Create new</Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <Card className="flex items-center justify-center py-12 text-muted-foreground">
          <Spinner className="size-6" /> &nbsp; Loading…
        </Card>
      ) : error ? (
        <Card className="border-red-200 bg-red-50 text-red-800">{error}</Card>
      ) : (
        <Card>
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Period from</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Period to</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <DataTable
            rows={readings}
            columns={columns}
            filters={filters}
            rowKey={(r) => r.id}
            emptyMessage="No readings match the current filters."
          />
          <p className="mt-3 text-xs text-muted-foreground">
            “Upper split” is an estimate for that reading (base tariffs × share, incl. VAT) and excludes the
            semester-level 35% overage penalty — see /split for the full breakdown.
          </p>
        </Card>
      )}

      {/* Sync & auto-parse result popup */}
      <Modal
        open={!!syncResult && !syncing}
        onClose={() => setSyncResult(null)}
        title="Gmail sync & auto-parse"
        footer={
          <Button variant="outline" onClick={() => setSyncResult(null)}>
            Close
          </Button>
        }
      >
        {syncResult && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Badge tone={syncResult.found ? "success" : syncResult.ok ? "warning" : "danger"}>
                {syncResult.found ? "Found & downloaded" : syncResult.ok ? "Nothing new" : "Error"}
              </Badge>
              <span className="text-sm text-muted-foreground">{syncResult.status}</span>
            </div>

            {syncResult.error && (
              <p className="text-sm text-red-700">{syncResult.error}</p>
            )}

            {syncResult.files.length > 0 && (
              <div>
                <p className="mb-1 text-sm font-medium">Downloaded:</p>
                <ul className="list-disc pl-5 text-sm text-muted-foreground">
                  {syncResult.files.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
            )}

            {syncResult.lastEmail && (
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Last matched email
                </p>
                <p className="mt-1 text-sm font-medium">
                  {syncResult.lastEmail.subject || "(no subject)"}
                </p>
                {syncResult.lastEmail.from && (
                  <p className="text-sm text-muted-foreground">{syncResult.lastEmail.from}</p>
                )}
                {syncResult.lastEmail.date && (
                  <p className="text-xs text-muted-foreground">
                    {formatDateWithTime(syncResult.lastEmail.date)}
                  </p>
                )}
                <p className="mt-1 text-xs">
                  {syncResult.lastEmail.wasParsed ? (
                    <span className="text-green-700">Parsed automatically</span>
                  ) : (
                    <span className="text-amber-700">Not parsed (image or parse skipped)</span>
                  )}
                </p>
              </div>
            )}

            {!syncResult.lastEmail && (
              <p className="text-sm text-muted-foreground">
                No new invoice email was pulled this run.
              </p>
            )}
          </div>
        )}
      </Modal>

      <PaymentModal
        open={!!payTarget}
        target={payTarget}
        onClose={() => setPayTarget(null)}
      />
    </div>
  );
}

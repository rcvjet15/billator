"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Eye, FileText, Pencil, Trash2 } from "lucide-react";

import { Button, Spinner } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable, type DataTableColumn, type DataTableFilter } from "@/components/ui/DataTable";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { useReadings } from "@/hooks/useReadings";
import { formatDate, formatDateWithTime, formatEur, formatKwh } from "@/utils/format";
import type { Reading } from "@/lib/calc/types";

export default function ReadingsPage() {
  const { readings, loading, error, remove } = useReadings();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

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
        render: (r) =>
          r.status === "complete" ? (
            <Badge tone="success">complete</Badge>
          ) : (
            <Badge tone="warning">incomplete</Badge>
          ),
      },
      {
        key: "actions",
        header: "Actions",
        render: (r) => (
          <div className="flex items-center gap-1">
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
        <Link href="/readings/new">
          <Button>Create new</Button>
        </Link>
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
    </div>
  );
}

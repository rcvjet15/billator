"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";

import { Button, Spinner } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { useReadings } from "@/hooks/useReadings";
import { api } from "@/lib/api";
import { estimateReadingUpperCost } from "@/lib/calc/readingCost";
import { formatDate, formatDateWithTime, formatEur, formatKwh } from "@/utils/format";
import type { Reading, TariffConfig } from "@/lib/calc/types";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export default function ReadingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [reading, setReading] = useState<Reading | null>(null);
  const [tariff, setTariff] = useState<TariffConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const { remove } = useReadings();

  useEffect(() => {
    void (async () => {
      try {
        const [r, s] = await Promise.all([
          api.getReading(id),
          api.getSettings(),
        ]);
        setReading(r.reading);
        setTariff(s.settings.tariffs);
      } catch {
        // leave loading handled
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 text-muted-foreground">
        <Spinner className="size-5" /> Loading reading…
      </div>
    );
  }

  if (!reading) {
    return <p className="text-red-600">Reading not found.</p>;
  }

  const complete = reading.status === "complete";
  const upperCost = tariff ? estimateReadingUpperCost(reading, tariff) : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            Reading {formatDate(reading.periodStart)} → {formatDate(reading.periodEnd)}
          </h1>
          <p className="text-muted-foreground">
            {renderBadgeStatus(complete)}
            {" · "}
            {reading.origin === "parsed" ? <Badge tone="info">parsed from PDF</Badge> : <Badge>manual entry</Badge>}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/readings">
            <Button variant="ghost">Back</Button>
          </Link>
          {reading.sourcePdfId && (
            <a href={`/api/inbox/${reading.sourcePdfId}/download`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline">Download PDF</Button>
            </a>
          )}
          <Link href={`/readings/edit/${reading.id}`}>
            <Button variant="outline">Edit / reimport</Button>
          </Link>
          <Button
            variant="destructive"
            onClick={() => {
              if (window.confirm("Delete this reading?")) void remove(reading.id);
            }}
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Invoice / HEP data */}
        <Card>
          <CardHeader title="HEP invoice" />
          <DetailRow label="Period" value={`${formatDate(reading.periodStart)} → ${formatDate(reading.periodEnd)}`} />
          <DetailRow label="HEP VT" value={formatKwh(reading.hepVtKwh)} />
          <DetailRow label="HEP NT" value={formatKwh(reading.hepNtKwh)} />
          <DetailRow label="Supply" value={formatEur(reading.hepTotalSupply)} />
          <DetailRow label="Fees" value={formatEur(reading.hepFees)} />
          <DetailRow label="Grand total" value={<strong>{formatEur(reading.hepGrandTotal)}</strong>} />
          {reading.sourcePdfName && <DetailRow label="Source PDF" value={reading.sourcePdfName} />}
        </Card>

        {/* Floor monitor */}
        <Card>
          <CardHeader title="Upper floor monitor" />
          <DetailRow label="Upper VT" value={formatKwh(reading.upperVtKwh)} />
          <DetailRow label="Upper NT" value={formatKwh(reading.upperNtKwh)} />
          <DetailRow label="Upper total" value={formatKwh(reading.upperVtKwh + reading.upperNtKwh)} />
          <DetailRow
            label="Upper split (estimate)"
            value={upperCost != null ? <strong>{formatEur(upperCost)}</strong> : "—"}
          />
          <DetailRow label="Created" value={formatDateWithTime(reading.createdAt)} />
          <DetailRow label="Updated" value={formatDateWithTime(reading.updatedAt)} />
        </Card>
      </div>

      {/* Prices used */}
      {tariff && (
        <Card>
          <CardHeader title="Prices used" subtitle="Effective tariff config for this calculation." />
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            <DetailRow label="VT rate" value={formatEur(tariff.energyRateVt)} />
            <DetailRow label="NT rate" value={formatEur(tariff.energyRateNt)} />
            <DetailRow label="Fixed fee" value={formatEur(tariff.fixedFee)} />
            <DetailRow label="Grid fee" value={formatEur(tariff.gridFeeRate)} />
            <DetailRow label="VAT" value={`${(tariff.vatRate * 100).toFixed(0)}%`} />
          </div>
        </Card>
      )}

      {/* Formulas */}
      <Card>
        <CardHeader title="How it&apos;s computed" />
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            Upper energy = upper VT × VT rate + upper NT × NT rate
          </li>
          <li>
            Fixed + grid fee = share of upper floor (upper kWh ÷ HEP kWh) × (fixed fee + grid fee)
          </li>
          <li>VAT × (rates + fees) is applied at {tariff ? (tariff.vatRate * 100).toFixed(0) : "—"}%.</li>
          <li>
            This row is an <strong>estimate</strong>; the semester-level 3,000 kWh +35% overage penalty is computed
            per semester block on the <Link href="/split" className="text-primary underline">Split</Link> page.
          </li>
        </ul>
      </Card>
    </div>
  );
}

function renderBadgeStatus(complete: boolean): React.ReactNode {
  return complete ? <Badge tone="success">complete</Badge> : <Badge tone="warning">incomplete</Badge>;
}

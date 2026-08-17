"use client";

import { useEffect } from "react";

import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Stat } from "@/components/ui/Stat";
import { useReadings } from "@/hooks/useReadings";
import { useSplit } from "@/hooks/useSplit";
import { formatDate, formatEur, formatKwh, formatPct } from "@/utils/format";

export default function Home() {
  const { result, loading, error, calculate } = useSplit();
  const readings = useReadings();

  useEffect(() => {
    if (result === null && !loading && !error) {
      void calculate();
    }
  }, [result, loading, error, calculate]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground">
            Track the rolling 6-month HEP usage and split.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/readings">
            <Button variant="outline">Add reading</Button>
          </Link>
          <Link href="/split">
            <Button>View split</Button>
          </Link>
        </div>
      </div>

      {/* Semester tracker */}
      <Card>
        <CardHeader
          title="Semester tracker"
          subtitle={
            result
              ? `${result.semester.label} · ${formatDate(result.semester.start)} – ${formatDate(result.semester.end)}`
              : "Current rolling 6-month block"
          }
          action={
            result ? (
              result.overage.crossed ? (
                <Badge tone="warning">Over threshold</Badge>
              ) : (
                <Badge tone="success">Within limit</Badge>
              )
            ) : undefined
          }
        />
        {result ? (
          <div className="flex flex-col gap-4">
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span>
                  Running total:{" "}
                  <strong>{formatKwh(result.overage.runningTotalKwh)}</strong>
                </span>
                <span className="text-muted-foreground">
                  Threshold: {formatKwh(result.overage.thresholdKwh)}
                </span>
              </div>
              <ProgressBar
                value={result.overage.runningTotalKwh}
                max={result.overage.thresholdKwh}
                threshold={result.overage.thresholdKwh}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat
                label="Ground floor"
                value={formatEur(result.ground.totalOwed)}
                hint={`${formatPct(result.ground.consumption.share)} of usage`}
              />
              <Stat
                label="Upper floor"
                value={formatEur(result.upper.totalOwed)}
                hint={`${formatPct(result.upper.consumption.share)} of usage`}
              />
              <Stat
                label="Penalty"
                value={formatEur(result.penaltyCost)}
                accent={result.penaltyCost > 0 ? "negative" : "positive"}
              />
              <Stat
                label="Combined bill"
                value={formatEur(result.grandTotal)}
              />
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">
            Add a reading to start tracking the semester.
          </p>
        )}
      </Card>

      {/* Recent readings */}
      <Card>
        <CardHeader title="Recent readings" />
        {readings.loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : readings.readings.length === 0 ? (
          <p className="text-muted-foreground">
            No readings yet.{" "}
            <Link href="/readings" className="text-primary underline">
              Add your first month
            </Link>
            .
          </p>
        ) : (
          <p className="text-muted-foreground">
            {readings.readings.length} monthly reading
            {readings.readings.length === 1 ? "" : "s"} recorded.
          </p>
        )}
      </Card>
    </div>
  );
}

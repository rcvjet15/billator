"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Input } from "@/components/ui/Input";
import { Stat } from "@/components/ui/Stat";
import { useReadings } from "@/hooks/useReadings";
import { useSettings } from "@/hooks/useSettings";
import { useSplit } from "@/hooks/useSplit";
import { groupReadings, type GroupBy } from "@/lib/calc/groupReadings";
import { formatDate, formatEur, formatKwh, formatPct } from "@/utils/format";

export default function Home() {
  const { result, loading: splitLoading, error: splitError, calculate } = useSplit();
  const readings = useReadings();
  const { settings } = useSettings();

  const [groupBy, setGroupBy] = useState<GroupBy>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (result === null && !splitLoading && !splitError) {
      void calculate();
    }
  }, [result, splitLoading, splitError, calculate]);

  // Filtered readings (by period start).
  const filtered = useMemo(() => {
    return readings.readings.filter((r) => {
      if (from && r.periodStart < from) return false;
      if (to && r.periodStart > to) return false;
      return true;
    });
  }, [readings.readings, from, to]);

  // Grouped totals.
  const groups = useMemo(() => {
    const cycle = settings?.semesters;
    return groupReadings(filtered, groupBy, cycle);
  }, [filtered, groupBy, settings?.semesters]);

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
          <Link href="/readings/new">
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

      {/* Usage breakdown: filters + grouping */}
      <Card>
        <CardHeader
          title="Usage"
          subtitle="Filter and group readings by period, month, year or semester."
        />
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Period from</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Period to</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Group by</label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
              className="h-10 rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="month">Month</option>
              <option value="year">Year</option>
              <option value="semester">Semester</option>
            </select>
          </div>
        </div>

        {readings.loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : groups.length === 0 ? (
          <p className="text-muted-foreground">
            No readings in the selected range.{" "}
            <Link href="/readings/new" className="text-primary underline">
              Add a reading
            </Link>
            .
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-4">Group</th>
                  <th className="py-2 pr-4">Readings</th>
                  <th className="py-2 pr-4">HEP kWh</th>
                  <th className="py-2 pr-4">Upper kWh</th>
                  <th className="py-2 pr-4">HEP amount</th>
                  <th className="py-2">Upper split</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.key} className="border-b border-border last:border-0">
                    <td className="py-2 pr-4 font-medium">{g.label}</td>
                    <td className="py-2 pr-4">{g.count}</td>
                    <td className="py-2 pr-4">{formatKwh(g.hepVtKwh + g.hepNtKwh)}</td>
                    <td className="py-2 pr-4">{formatKwh(g.upperVtKwh + g.upperNtKwh)}</td>
                    <td className="py-2 pr-4">{formatEur(g.hepTotal)}</td>
                    <td className="py-2">{formatEur(g.upperCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
            <Link href="/readings/new" className="text-primary underline">
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

"use client";

import { useEffect } from "react";

import { SplitBreakdown } from "@/components/split/SplitBreakdown";
import { Button, Spinner } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSplit } from "@/hooks/useSplit";

export default function SplitPage() {
  const { result, loading, error, calculate } = useSplit();

  useEffect(() => {
    void calculate();
  }, [calculate]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Bill split</h1>
          <p className="text-muted-foreground">
            Current semester breakdown between the two floors.
          </p>
        </div>
        <Button onClick={() => calculate()} loading={loading}>
          Recalculate
        </Button>
      </div>

      {loading && !result && (
        <Card className="flex items-center justify-center py-16 text-muted-foreground">
          <Spinner className="size-6" /> &nbsp; Calculating split…
        </Card>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50 text-red-800">{error}</Card>
      )}

      {!loading && result && <SplitBreakdown result={result} />}

      {!loading && !error && !result && (
        <Card className="py-12 text-center text-muted-foreground">
          No readings yet. Add a reading to calculate the split.
        </Card>
      )}
    </div>
  );
}

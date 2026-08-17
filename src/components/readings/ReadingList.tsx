import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { Reading } from "@/lib/calc/types";
import { formatEur, formatKwh } from "@/utils/format";

export function ReadingRow({
  reading,
  onDelete,
  onContinue,
}: {
  reading: Reading;
  onDelete: (id: string) => Promise<void>;
  onContinue?: (r: Reading) => void;
}) {
  const complete = reading.status === "complete";
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0">
      <div>
        <div className="flex items-center gap-2">
          <p className="font-medium">
            {reading.periodStart} → {reading.periodEnd}
          </p>
          {complete ? (
            <Badge tone="success">complete</Badge>
          ) : (
            <Badge tone="warning">incomplete</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          HEP {formatKwh(reading.hepVtKwh + reading.hepNtKwh)} / upper{" "}
          {formatKwh(reading.upperVtKwh + reading.upperNtKwh)} · total{" "}
          {formatEur(reading.hepGrandTotal)}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {onContinue && (
          <Button variant="outline" size="sm" onClick={() => onContinue(reading)}>
            {complete ? "Edit" : "Continue"}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => onDelete(reading.id)}>
          Delete
        </Button>
      </div>
    </div>
  );
}

export function ReadingList({
  readings,
  onDelete,
  onContinue,
}: {
  readings: Reading[];
  onDelete: (id: string) => Promise<void>;
  onContinue?: (r: Reading) => void;
}) {
  if (readings.length === 0) {
    return (
      <p className="py-6 text-center text-muted-foreground">No readings yet.</p>
    );
  }
  return (
    <Card>
      {readings.map((r) => (
        <ReadingRow
          key={r.id}
          reading={r}
          onDelete={onDelete}
          onContinue={onContinue}
        />
      ))}
    </Card>
  );
}

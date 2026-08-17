import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Reading } from "@/lib/calc/types";
import { formatEur, formatKwh } from "@/utils/format";

export function ReadingRow({
  reading,
  onDelete,
}: {
  reading: Reading;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0">
      <div>
        <p className="font-medium">
          {reading.periodStart} → {reading.periodEnd}
        </p>
        <p className="text-sm text-muted-foreground">
          HEP {formatKwh(reading.hepVtKwh + reading.hepNtKwh)} / upper{" "}
          {formatKwh(reading.upperVtKwh + reading.upperNtKwh)} · total{" "}
          {formatEur(reading.hepGrandTotal)}
        </p>
      </div>
      <Button variant="ghost" size="sm" onClick={() => onDelete(reading.id)}>
        Delete
      </Button>
    </div>
  );
}

export function ReadingList({
  readings,
  onDelete,
}: {
  readings: Reading[];
  onDelete: (id: string) => Promise<void>;
}) {
  if (readings.length === 0) {
    return (
      <p className="py-6 text-center text-muted-foreground">No readings yet.</p>
    );
  }
  return (
    <Card>
      {readings.map((r) => (
        <ReadingRow key={r.id} reading={r} onDelete={onDelete} />
      ))}
    </Card>
  );
}

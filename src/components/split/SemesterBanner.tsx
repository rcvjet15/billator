import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { SplitResult } from "@/lib/calc/types";
import { formatDate, formatKwh } from "@/utils/format";

export function SemesterBanner({ result }: { result: SplitResult }) {
  const { semester, overage } = result;
  const crossed = overage.crossed;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Semester block
          </p>
          <h2 className="text-xl font-semibold">{semester.label}</h2>
          <p className="text-sm text-muted-foreground">
            {formatDate(semester.start)} – {formatDate(semester.end)}
          </p>
        </div>
        {crossed ? (
          <Badge tone="warning">Over threshold</Badge>
        ) : (
          <Badge tone="success">Within limit</Badge>
        )}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-sm">
          <span>
            Running total: <strong>{formatKwh(overage.runningTotalKwh)}</strong>
          </span>
          <span className="text-muted-foreground">
            Threshold: {formatKwh(overage.thresholdKwh)}
          </span>
        </div>
        <ProgressBar
          value={overage.runningTotalKwh}
          max={overage.thresholdKwh}
          threshold={overage.thresholdKwh}
        />
        {crossed && (
          <p className="mt-2 text-sm text-amber-700">
            {formatKwh(overage.overageKwh)} above the {formatKwh(overage.thresholdKwh)}{" "}
            threshold is charged at {Math.round((overage.penaltyMultiplier - 1) * 100)}%
            higher rate.
          </p>
        )}
      </div>
    </div>
  );
}

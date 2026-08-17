import { cn } from "@/utils/cn";

export function ProgressBar({
  value,
  max,
  threshold,
  className,
}: {
  value: number;
  max: number;
  threshold?: number;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const overThreshold = threshold !== undefined && value > threshold;
  const barColor = overThreshold ? "bg-accent" : "bg-primary";
  const trackColor = threshold !== undefined ? "bg-amber-100" : "bg-muted";

  return (
    <div
      className={cn("h-3 w-full overflow-hidden rounded-full", trackColor, className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemax={max}
    >
      <div
        className={cn("h-full rounded-full transition-all", barColor)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

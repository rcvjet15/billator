import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

export function Stat({
  label,
  value,
  hint,
  accent,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: "neutral" | "positive" | "negative";
  className?: string;
}) {
  const accentColor =
    accent === "positive"
      ? "text-green-700"
      : accent === "negative"
        ? "text-red-700"
        : "text-foreground";
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={cn("text-2xl font-semibold", accentColor)}>{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

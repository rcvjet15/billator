import type { ReactNode } from "react";
import { Input } from "@/components/ui/Input";

/** Label + input (or children) row used in settings forms. */
export function Field({
  label,
  value,
  onChange,
  type = "text",
  hint,
  placeholder,
  min,
  max,
  step,
}: {
  label: string;
  value: ReactNode;
  onChange?: (v: string) => void;
  type?: string;
  hint?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      {onChange ? (
        <Input
          type={type}
          value={value as string}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        value
      )}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

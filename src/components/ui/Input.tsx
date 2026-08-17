import type { InputHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return (
    <input
      className={cn(
        "h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...rest}
    />
  );
}

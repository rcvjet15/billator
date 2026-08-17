"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/utils/cn";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible label (also shown as the hover tooltip). */
  label: string;
  icon: ReactNode;
  tone?: "default" | "danger";
}

/**
 * A small icon button with a CSS hover tooltip. Visible text label is used for
 * both the accessible name and the tooltip, so the table's action column can
 * stay compact.
 */
export function IconButton({ label, icon, tone = "default", className, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        tone === "danger" && "hover:bg-red-50 hover:text-red-700",
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  );
}

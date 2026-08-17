"use client";

import { cn } from "@/utils/cn";

export interface TabItem {
  id: string;
  label: string;
}

export function Tabs({
  tabs,
  active,
  onActive,
}: {
  tabs: TabItem[];
  active: string;
  onActive: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-border">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onActive(t.id)}
          className={cn(
            "rounded-t-md px-4 py-2 text-sm font-medium transition-colors",
            active === t.id
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

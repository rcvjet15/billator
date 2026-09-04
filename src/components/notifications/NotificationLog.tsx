"use client";

import { useEffect, useState } from "react";

import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button, Spinner } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { formatDateWithTime } from "@/utils/format";
import type { NotificationLog } from "@/lib/calc/types";

export function NotificationLogCard() {
  const [logs, setLogs] = useState<NotificationLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { logs } = await api.listNotificationLogs();
        if (!cancelled) {
          setLogs(logs);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const clear = async () => {
    try {
      await api.clearNotificationLogs();
      setLogs([]);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardHeader
          title="Sent notifications"
          subtitle="Latest delivery attempts across Home Assistant and Web Push."
        />
        <Button variant="outline" size="sm" onClick={() => void clear()}>
          Clear
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!logs && !error && (
        <div className="flex items-center gap-2 py-6 text-muted-foreground">
          <Spinner className="size-4" /> Loading…
        </div>
      )}

      {logs && logs.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No notifications have been sent yet.
        </p>
      )}

      {logs && logs.length > 0 && (
        <ul className="flex flex-col gap-2">
          {logs.map((l) => (
            <li
              key={l.id}
              className="flex flex-col gap-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <Badge tone={l.ok ? "success" : "danger"}>
                  {l.ok ? "sent" : "failed"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {l.channel === "home_assistant"
                    ? "Home Assistant"
                    : "Web Push"}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatDateWithTime(l.createdAt)}
                </span>
              </div>
              {l.title && <span className="font-medium">{l.title}</span>}
              {l.message && (
                <span className="text-muted-foreground">{l.message}</span>
              )}
              {l.detail && !l.ok && (
                <span className="text-xs text-red-600">{l.detail}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

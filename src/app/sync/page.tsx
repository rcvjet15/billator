"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Button";
import { useSync } from "@/hooks/useSync";
import { formatDate, formatDateWithTime } from "@/utils/format";

export default function SyncPage() {
  const {
    logs,
    inbox,
    status,
    loading,
    syncing,
    error,
    refresh,
    syncNow,
    removeInboxItem,
    reSyncMessage,
    clearLogs,
  } = useSync();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Sync</h1>
          <p className="text-muted-foreground">
            Gmail polling, sync logs, and downloaded invoice PDFs.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void refresh()}>
            Refresh
          </Button>
          <Button onClick={() => void syncNow()} loading={syncing}>
            Sync now
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Status */}
      <Card>
        <CardHeader title="Gmail status" />
        {loading ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Spinner className="size-4" /> Loading…
          </p>
        ) : status ? (
          <div className="flex flex-wrap gap-2">
            <Badge tone={status.enabled ? "success" : "default"}>
              {status.enabled ? "Enabled" : "Disabled"}
            </Badge>
            <Badge tone={status.configured ? "success" : "warning"}>
              {status.configured ? "Configured" : "Not configured"}
            </Badge>
            <Badge tone={status.authorized ? "success" : "warning"}>
              {status.authorized ? "Authorized" : "Not authorized"}
            </Badge>
            {!status.configured && (
              <span className="text-sm text-muted-foreground">
                Set credentials in Settings → Gmail.
              </span>
            )}
          </div>
        ) : null}
      </Card>

      {/* Sync logs */}
      <Card>
        <CardHeader
          title="Sync logs"
          subtitle="Recent polling runs"
          action={
            logs.length > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => void clearLogs()}>
                Clear
              </Button>
            ) : undefined
          }
        />
        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : logs.length === 0 ? (
          <p className="text-muted-foreground">No sync runs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-4">Time</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Bills</th>
                  <th className="py-2 pr-4">File</th>
                  <th className="py-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-4 whitespace-nowrap">{formatDateWithTime(l.timestamp)}</td>
                    <td className="py-2 pr-4">
                      <Badge tone={l.ok ? "success" : "danger"}>
                        {l.ok ? "OK" : "Error"}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4">{l.found ? "Yes" : "No"}</td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {l.downloadedFile ?? "—"}
                    </td>
                    <td className="py-2 text-muted-foreground">{l.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Inbox */}
      <Card>
        <CardHeader
          title="Invoice inbox"
          subtitle="Downloaded PDFs. Open / parse them to create a reading."
        />
        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : inbox.length === 0 ? (
          <p className="text-muted-foreground">
            No downloaded invoices yet. Run a sync to pull new HEP PDFs.
          </p>
        ) : (
          <div className="flex flex-col">
            {inbox.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-0"
              >
                <div>
                  <p className="font-medium">{p.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(p.downloadedAt)} ·{" "}
                    {p.parsedAt ? "parsed" : "not yet parsed"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <a
                    href={`/api/inbox/${p.id}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary underline"
                  >
                    View
                  </a>
                  {p.msgId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={syncing}
                      title="Delete this email's records and pull it again"
                      onClick={() => void reSyncMessage(p.msgId!)}
                    >
                      Re-sync
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void removeInboxItem(p.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

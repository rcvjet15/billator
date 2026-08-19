"use client";

import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { SyncLog, InboxPdf } from "@/lib/calc/types";

export function useSync() {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [inbox, setInbox] = useState<InboxPdf[]>([]);
  const [status, setStatus] = useState<{
    enabled: boolean;
    configured: boolean;
    authorized: boolean;
    ready: boolean;
    pollIntervalMs: number;
    query: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [logsRes, inboxRes, statusRes] = await Promise.all([
        api.listSyncLogs(),
        api.listInbox(),
        api.gmailStatus().catch(() => null),
      ]);
      setLogs(logsRes.logs);
      setInbox(inboxRes.inbox);
      setStatus(statusRes);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [logsRes, inboxRes, statusRes] = await Promise.all([
          api.listSyncLogs(),
          api.listInbox(),
          api.gmailStatus().catch(() => null),
        ]);
        if (!cancelled) {
          setLogs(logsRes.logs);
          setInbox(inboxRes.inbox);
          setStatus(statusRes);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const syncNow = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      await api.runGmailSync();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }, [refresh]);

  const removeInboxItem = useCallback(async (id: string) => {
    await api.deleteInboxItem(id);
    setInbox((prev) => prev.filter((p) => p.id !== id));
  }, []);

  /** Delete a specific email's dedup records, then pull & parse it again. */
  const reSyncMessage = useCallback(
    async (msgId: string) => {
      setSyncing(true);
      setError(null);
      try {
        await api.clearMsgDedup(msgId);
        await api.runGmailSync();
        await refresh();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSyncing(false);
      }
    },
    [refresh],
  );

  const clearLogs = useCallback(async () => {
    await api.clearSyncLogs();
    setLogs([]);
  }, []);

  return {
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
  };
}

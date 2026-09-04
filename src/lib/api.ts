import type { Reading, ReadingInput, SplitResult, SyncLog, InboxPdf, Payment, PaymentInput, NotificationLog } from "@/lib/calc/types";
import type { HepParseResult } from "@/lib/parse/hep";
import type { AppSettings } from "@/lib/settings/types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body = (await res.json().catch(() => ({}))) as Partial<{ error?: string }> &
    T;
  if (!res.ok) {
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return body as T;
}

export const api = {
  listReadings: (): Promise<{ readings: Reading[] }> =>
    request("/api/readings"),

  getReading: (id: string): Promise<{ reading: Reading }> =>
    request(`/api/readings/${id}`),

  createReading: (input: ReadingInput): Promise<{ reading: Reading }> =>
    request("/api/readings", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateReading: (
    id: string,
    input: Partial<ReadingInput>,
  ): Promise<{ reading: Reading }> =>
    request(`/api/readings/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),

  deleteReading: (id: string): Promise<{ ok: boolean }> =>
    request(`/api/readings/${id}`, { method: "DELETE" }),

  calculateSplit: (date?: string): Promise<SplitResult> =>
    request("/api/split/calculate", {
      method: "POST",
      body: JSON.stringify({ date: date ?? new Date().toISOString() }),
    }),

  parseHepPdf: (file: File): Promise<{ result: HepParseResult }> => {
    const body = new FormData();
    body.append("file", file);
    return fetch("/api/parse/hep", { method: "POST", body }).then(async (res) => {
      const data = (await res.json().catch(() => ({}))) as {
        result?: HepParseResult;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Parse failed");
      return { result: data.result! };
    });
  },

  getSettings: (): Promise<{ settings: AppSettings }> =>
    request("/api/settings"),

  updateSettings: (
    patch: Partial<AppSettings>,
  ): Promise<{ settings: AppSettings }> =>
    request("/api/settings", { method: "PUT", body: JSON.stringify(patch) }),

  listSyncLogs: (): Promise<{ logs: SyncLog[] }> =>
    request("/api/sync/logs"),

  clearSyncLogs: (): Promise<{ ok: boolean }> =>
    request("/api/sync/logs", { method: "DELETE" }),

  listInbox: (): Promise<{ inbox: InboxPdf[] }> => request("/api/inbox"),

  deleteInboxItem: (id: string): Promise<{ ok: boolean }> =>
    request(`/api/inbox/${id}`, { method: "DELETE" }),

  createReadingFromInbox: (id: string): Promise<{ reading: Reading }> =>
    request(`/api/inbox/${id}/create-reading`, { method: "POST" }),

  clearMsgDedup: (msgId: string): Promise<{ ok: boolean; removed: number }> =>
    request("/api/inbox/clear-msg", {
      method: "POST",
      body: JSON.stringify({ msgId }),
    }),

  runGmailSync: (): Promise<{
    outcome: {
      ok: boolean;
      found: boolean;
      files: string[];
      status: string;
      lastEmail?: {
        messageId: string;
        subject?: string;
        from?: string;
        date?: string;
        wasParsed: boolean;
      };
    };
  }> => request("/api/gmail/sync", { method: "POST" }),

  gmailStatus: (): Promise<{
    enabled: boolean;
    configured: boolean;
    authorized: boolean;
    ready: boolean;
    pollIntervalMs: number;
    query: string;
  }> => request("/api/gmail/status"),

  pushPublicKey: (): Promise<{ publicKey: string | null }> =>
    request("/api/push/public-key"),

  pushSubscribe: (subscription: unknown): Promise<{ ok: boolean; settings: AppSettings }> =>
    request("/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify({ subscription }),
    }),

  pushUnsubscribe: (): Promise<{ ok: boolean; settings: AppSettings }> =>
    request("/api/push/unsubscribe", { method: "POST" }),

  pushTest: (): Promise<{ ok: boolean }> => request("/api/push/test", { method: "POST" }),

  listPayments: (): Promise<{ payments: Payment[] }> => request("/api/payments"),

  createPayment: (input: PaymentInput): Promise<{ payment: Payment }> =>
    request("/api/payments", { method: "POST", body: JSON.stringify(input) }),

  updatePayment: (
    id: string,
    patch: Partial<Pick<Payment, "status" | "note">>,
  ): Promise<{ payment: Payment }> =>
    request(`/api/payments/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),

  deletePayment: (id: string): Promise<{ ok: boolean }> =>
    request(`/api/payments/${id}`, { method: "DELETE" }),

  listNotificationLogs: (): Promise<{ logs: NotificationLog[] }> =>
    request("/api/notifications/log"),

  clearNotificationLogs: (): Promise<{ ok: boolean }> =>
    request("/api/notifications/log", { method: "DELETE" }),
};

export type PushSubscriptionLike = { endpoint: string; keys?: { p256dh?: string; auth?: string }; expirationTime?: number | null };

import type { Reading, ReadingInput, SplitResult } from "@/lib/calc/types";
import type { HepParseResult } from "@/lib/parse/hep";

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
};

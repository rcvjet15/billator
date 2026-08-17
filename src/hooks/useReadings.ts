"use client";

import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { Reading, ReadingInput } from "@/lib/calc/types";

/** Fetch and manage readings via the API. */
export function useReadings() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { readings: r } = await api.listReadings();
      setReadings(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load: drive setState only from the async completion, not
  // synchronously in the effect body.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { readings: r } = await api.listReadings();
        if (!cancelled) setReadings(r);
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

  const add = useCallback(async (input: ReadingInput) => {
    const { reading } = await api.createReading(input);
    setReadings((prev) => [reading, ...prev]);
    return reading;
  }, []);

  const update = useCallback(async (id: string, input: Partial<ReadingInput>) => {
    const { reading } = await api.updateReading(id, input);
    setReadings((prev) => prev.map((r) => (r.id === id ? reading : r)));
    return reading;
  }, []);

  const remove = useCallback(async (id: string) => {
    await api.deleteReading(id);
    setReadings((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return { readings, loading, error, add, update, remove, refresh };
}

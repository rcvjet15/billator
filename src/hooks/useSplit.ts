"use client";

import { useCallback, useState } from "react";

import { api } from "@/lib/api";
import type { SplitResult } from "@/lib/calc/types";

/** Compute the semester split via the API. */
export function useSplit() {
  const [result, setResult] = useState<SplitResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculate = useCallback(async (date?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.calculateSplit(date);
      setResult(res);
      return res;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { result, loading, error, calculate };
}

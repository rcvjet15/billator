"use client";

import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { AppSettings } from "@/lib/settings/types";

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { settings } = await api.getSettings();
      setSettings(settings);
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
        const { settings } = await api.getSettings();
        if (!cancelled) setSettings(settings);
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

  const save = useCallback(
    async (patch: Partial<AppSettings>) => {
      setSaving(true);
      setError(null);
      try {
        const { settings } = await api.updateSettings(patch);
        setSettings(settings);
        return settings;
      } catch (e) {
        setError((e as Error).message);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  return { settings, loading, saving, error, refresh, save, setSettings };
}

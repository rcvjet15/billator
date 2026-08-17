import type { TariffConfig } from "@/lib/calc/types";
import { DEFAULT_CONFIG, envTariffOverrides } from "@/lib/default-config";
import { loadSettings } from "@/lib/settings";

/**
 * Resolves the effective tariff configuration by merging, in order:
 *   defaults -> env overrides -> DB settings.
 * Mirrors the reference project's `config-service.ts` idiom.
 */
export async function getTariffConfig(): Promise<TariffConfig> {
  const base: TariffConfig = { ...DEFAULT_CONFIG, ...envTariffOverrides() };
  try {
    const settings = await loadSettings();
    return { ...base, ...settings.tariffs };
  } catch {
    return base;
  }
}

export function getDefaultTariffConfig(): TariffConfig {
  return { ...DEFAULT_CONFIG, ...envTariffOverrides() };
}

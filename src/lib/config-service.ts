import type { TariffConfig } from "@/lib/calc/types";
import { DEFAULT_CONFIG, envTariffOverrides } from "@/lib/default-config";
import { StorageService } from "@/lib/storage-service";

/**
 * Resolves the effective tariff configuration by merging, in order:
 *   defaults -> env overrides -> optional DB row override.
 * Mirrors the reference project's `config-service.ts` idiom.
 */
export async function getTariffConfig(): Promise<TariffConfig> {
  const merged: TariffConfig = {
    ...DEFAULT_CONFIG,
    ...envTariffOverrides(),
  };

  try {
    const storage = StorageService.getInstance();
    const dbOverride = await storage.getTariffConfig();
    if (dbOverride) {
      return { ...merged, ...dbOverride };
    }
  } catch {
    // Storage unavailable (e.g. not configured). Fall back to defaults+env.
  }

  return merged;
}

export function getDefaultTariffConfig(): TariffConfig {
  return { ...DEFAULT_CONFIG, ...envTariffOverrides() };
}

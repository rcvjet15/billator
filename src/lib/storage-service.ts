import type { Reading, TariffConfig } from "@/lib/calc/types";
import { env } from "@/lib/env";
import { StorageAdapter } from "@/lib/storage/abstract-storage";
import { FilesystemAdapter } from "@/lib/storage/filesystem-adapter";
import { SupabaseAdapter } from "@/lib/storage/supabase-adapter";

/**
 * Singleton facade over the active storage adapter, selected by STORAGE_MODE.
 * Mirrors the reference project's `storage-service.ts` idiom.
 */
class StorageService {
  private static instance: StorageService | null = null;

  private readonly adapter: StorageAdapter;

  private constructor() {
    env.logConfiguration();
    this.adapter = this.createAdapter();
  }

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  static getAdapter(): StorageAdapter {
    return StorageService.getInstance().adapter;
  }

  private createAdapter(): StorageAdapter {
    if (env.isSupabaseEnabled()) {
      return new SupabaseAdapter();
    }
    return new FilesystemAdapter();
  }

  // ---- pass-throughs -----------------------------------------------------

  listReadings(): Promise<Reading[]> {
    return this.adapter.listReadings();
  }

  getReading(id: string): Promise<Reading | null> {
    return this.adapter.getReading(id);
  }

  createReading(
    input: Omit<
      Reading,
      "id" | "createdAt" | "updatedAt" | "periodStart" | "periodEnd"
    > & { periodStart: string; periodEnd: string },
  ): Promise<Reading> {
    return this.adapter.createReading(input);
  }

  updateReading(
    id: string,
    input: Partial<Reading>,
  ): Promise<Reading | null> {
    return this.adapter.updateReading(id, input);
  }

  deleteReading(id: string): Promise<boolean> {
    return this.adapter.deleteReading(id);
  }

  getTariffConfig(): Promise<Partial<TariffConfig> | null> {
    return this.adapter.getTariffConfig();
  }

  setTariffConfig(
    config: Partial<TariffConfig>,
  ): Promise<Partial<TariffConfig>> {
    return this.adapter.setTariffConfig(config);
  }
}

export { StorageService };

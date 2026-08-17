import type { Reading, TariffConfig } from "@/lib/calc/types";

/**
 * Storage abstraction for all persistent data. Concrete adapters implement
 * this for a backend (Postgres/Supabase, local filesystem, etc.). Mirrors the
 * reference project's `abstract-storage.ts` idiom.
 */
export abstract class StorageAdapter {
  /** List all readings, newest first. */
  abstract listReadings(): Promise<Reading[]>;

  /** Get a single reading by id, or null when missing. */
  abstract getReading(id: string): Promise<Reading | null>;

  /** Create a reading, returning the persisted record with id/timestamps. */
  abstract createReading(
    input: Omit<
      Reading,
      "id" | "createdAt" | "updatedAt" | "periodStart" | "periodEnd"
    > & {
      periodStart: string;
      periodEnd: string;
    },
  ): Promise<Reading>;

  /** Update an existing reading (partial). Returns updated record or null. */
  abstract updateReading(
    id: string,
    input: Partial<Reading>,
  ): Promise<Reading | null>;

  /** Delete a reading, returning true if one was removed. */
  abstract deleteReading(id: string): Promise<boolean>;

  /** Get the tariff_config override row, if present. */
  abstract getTariffConfig(): Promise<Partial<TariffConfig> | null>;

  /** Upsert the tariff_config override row. */
  abstract setTariffConfig(
    config: Partial<TariffConfig>,
  ): Promise<Partial<TariffConfig>>;
}

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Reading, TariffConfig } from "@/lib/calc/types";
import { randomUUID } from "node:crypto";
import { StorageAdapter } from "@/lib/storage/abstract-storage";

interface FilesystemState {
  readings: Reading[];
  tariffConfig: Partial<TariffConfig> | null;
}

/**
 * Local filesystem adapter for development. Persists state as a JSON file so
 * the app works without Postgres/Supabase wired up. Matches the reference
 * project's `filesystem-adapter.ts` (simple local fallback).
 */
export class FilesystemAdapter extends StorageAdapter {
  private filePath: string;

  constructor(filePath?: string) {
    super();
    this.filePath =
      filePath || process.env.DATA_FILE || path.join(process.cwd(), "data", "store.json");
  }

  private async read(): Promise<FilesystemState> {
    try {
      const raw = await readFile(this.filePath, "utf-8");
      const parsed = JSON.parse(raw) as Partial<FilesystemState>;
      return {
        readings: parsed.readings ?? [],
        tariffConfig: parsed.tariffConfig ?? null,
      };
    } catch {
      return { readings: [], tariffConfig: null };
    }
  }

  private async write(state: FilesystemState): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(state, null, 2), "utf-8");
  }

  async listReadings(): Promise<Reading[]> {
    const state = await this.read();
    return [...state.readings].sort((a, b) =>
      b.periodStart.localeCompare(a.periodStart),
    );
  }

  async getReading(id: string): Promise<Reading | null> {
    const state = await this.read();
    return state.readings.find((r) => r.id === id) ?? null;
  }

  async createReading(
    input: Omit<Reading, "id" | "createdAt" | "updatedAt" | "periodStart" | "periodEnd"> & {
      periodStart: string;
      periodEnd: string;
    },
  ): Promise<Reading> {
    const state = await this.read();
    const now = new Date().toISOString();
    const reading: Reading = {
      ...input,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    state.readings.push(reading);
    await this.write(state);
    return reading;
  }

  async updateReading(
    id: string,
    input: Partial<Reading>,
  ): Promise<Reading | null> {
    const state = await this.read();
    const found = state.readings.find((r) => r.id === id);
    if (!found) return null;
    const updated: Reading = {
      ...found,
      ...input,
      id,
      updatedAt: new Date().toISOString(),
    };
    state.readings = state.readings.map((r) => (r.id === id ? updated : r));
    await this.write(state);
    return updated;
  }

  async deleteReading(id: string): Promise<boolean> {
    const state = await this.read();
    const next = state.readings.filter((r) => r.id !== id);
    if (next.length === state.readings.length) return false;
    state.readings = next;
    await this.write(state);
    return true;
  }

  async getTariffConfig(): Promise<Partial<TariffConfig> | null> {
    const state = await this.read();
    return state.tariffConfig;
  }

  async setTariffConfig(
    config: Partial<TariffConfig>,
  ): Promise<Partial<TariffConfig>> {
    const state = await this.read();
    state.tariffConfig = { ...state.tariffConfig, ...config };
    await this.write(state);
    return state.tariffConfig;
  }
}

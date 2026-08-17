import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Reading, TariffConfig } from "@/lib/calc/types";
import { env } from "@/lib/env";
import { StorageAdapter } from "@/lib/storage/abstract-storage";

type ReadingRow = {
  id: string;
  period_start: string;
  period_end: string;
  hep_vt_kwh: number;
  hep_nt_kwh: number;
  hep_total_supply: number;
  hep_fees: number;
  hep_grand_total: number;
  upper_vt_kwh: number;
  upper_nt_kwh: number;
  created_at: string;
  updated_at: string;
};

type TariffRow = {
  id: number;
  energy_rate_vt?: number;
  energy_rate_nt?: number;
  overage_multiplier?: number;
  overage_threshold_kwh?: number;
  fixed_fee?: number;
  grid_fee_rate?: number;
  vat_rate?: number;
};

const READING_ROWS =
  "id,period_start,period_end,hep_vt_kwh,hep_nt_kwh,hep_total_supply,hep_fees,hep_grand_total,upper_vt_kwh,upper_nt_kwh,created_at,updated_at";

function toReading(row: ReadingRow): Reading {
  return {
    id: row.id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    hepVtKwh: row.hep_vt_kwh,
    hepNtKwh: row.hep_nt_kwh,
    hepTotalSupply: row.hep_total_supply,
    hepFees: row.hep_fees,
    hepGrandTotal: row.hep_grand_total,
    upperVtKwh: row.upper_vt_kwh,
    upperNtKwh: row.upper_nt_kwh,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toTariff(row: TariffRow): Partial<TariffConfig> {
  return {
    ...(row.energy_rate_vt !== undefined && { energyRateVt: row.energy_rate_vt }),
    ...(row.energy_rate_nt !== undefined && { energyRateNt: row.energy_rate_nt }),
    ...(row.overage_multiplier !== undefined && {
      overageMultiplier: row.overage_multiplier,
    }),
    ...(row.overage_threshold_kwh !== undefined && {
      overageThresholdKwh: row.overage_threshold_kwh,
    }),
    ...(row.fixed_fee !== undefined && { fixedFee: row.fixed_fee }),
    ...(row.grid_fee_rate !== undefined && { gridFeeRate: row.grid_fee_rate }),
    ...(row.vat_rate !== undefined && { vatRate: row.vat_rate }),
  };
}

/**
 * Postgres / Supabase adapter. Uses the anon (public) client for reads and the
 * service-role key for writes, falling back to anon when a service key is
 * absent. Mirrors the reference project's `supabase-adapter.ts` role and its
 * `kv-adapter.ts` external-service wiring.
 */
export class SupabaseAdapter extends StorageAdapter {
  private client: SupabaseClient;

  constructor() {
    super();
    const url = env.supabase.url!;
    const key = env.supabase.serviceKey || env.supabase.anonKey!;
    this.client = createClient(url, key);
  }

  async listReadings(): Promise<Reading[]> {
    const { data, error } = await this.client
      .from("readings")
      .select(READING_ROWS)
      .order("period_start", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(toReading);
  }

  async getReading(id: string): Promise<Reading | null> {
    const { data, error } = await this.client
      .from("readings")
      .select(READING_ROWS)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toReading(data as ReadingRow) : null;
  }

  async createReading(
    input: Omit<Reading, "id" | "createdAt" | "updatedAt" | "periodStart" | "periodEnd"> & {
      periodStart: string;
      periodEnd: string;
    },
  ): Promise<Reading> {
    const { data, error } = await this.client
      .from("readings")
      .insert({
        period_start: input.periodStart,
        period_end: input.periodEnd,
        hep_vt_kwh: input.hepVtKwh,
        hep_nt_kwh: input.hepNtKwh,
        hep_total_supply: input.hepTotalSupply,
        hep_fees: input.hepFees,
        hep_grand_total: input.hepGrandTotal,
        upper_vt_kwh: input.upperVtKwh,
        upper_nt_kwh: input.upperNtKwh,
      })
      .select(READING_ROWS)
      .single();
    if (error) throw new Error(error.message);
    return toReading(data as ReadingRow);
  }

  async updateReading(
    id: string,
    input: Partial<Reading>,
  ): Promise<Reading | null> {
    const { data, error } = await this.client
      .from("readings")
      .update({
        ...(input.periodStart !== undefined && {
          period_start: input.periodStart,
        }),
        ...(input.periodEnd !== undefined && { period_end: input.periodEnd }),
        ...(input.hepVtKwh !== undefined && { hep_vt_kwh: input.hepVtKwh }),
        ...(input.hepNtKwh !== undefined && { hep_nt_kwh: input.hepNtKwh }),
        ...(input.hepTotalSupply !== undefined && {
          hep_total_supply: input.hepTotalSupply,
        }),
        ...(input.hepFees !== undefined && { hep_fees: input.hepFees }),
        ...(input.hepGrandTotal !== undefined && {
          hep_grand_total: input.hepGrandTotal,
        }),
        ...(input.upperVtKwh !== undefined && {
          upper_vt_kwh: input.upperVtKwh,
        }),
        ...(input.upperNtKwh !== undefined && {
          upper_nt_kwh: input.upperNtKwh,
        }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(READING_ROWS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toReading(data as ReadingRow) : null;
  }

  async deleteReading(id: string): Promise<boolean> {
    const { data, error } = await this.client
      .from("readings")
      .delete()
      .eq("id", id)
      .select("id");
    if (error) throw new Error(error.message);
    return (data?.length ?? 0) > 0;
  }

  async getTariffConfig(): Promise<Partial<TariffConfig> | null> {
    const { data, error } = await this.client
      .from("tariff_config")
      .select("*")
      .maybeSingle();
    if (error && error.code !== "PGRST116") throw new Error(error.message);
    if (!data) return null;
    return toTariff(data as TariffRow);
  }

  async setTariffConfig(
    config: Partial<TariffConfig>,
  ): Promise<Partial<TariffConfig>> {
    const row = {
      id: 1,
      energy_rate_vt: config.energyRateVt,
      energy_rate_nt: config.energyRateNt,
      overage_multiplier: config.overageMultiplier,
      overage_threshold_kwh: config.overageThresholdKwh,
      fixed_fee: config.fixedFee,
      grid_fee_rate: config.gridFeeRate,
      vat_rate: config.vatRate,
    };
    const { data, error } = await this.client
      .from("tariff_config")
      .upsert(row, { onConflict: "id" })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return toTariff(data as TariffRow);
  }
}

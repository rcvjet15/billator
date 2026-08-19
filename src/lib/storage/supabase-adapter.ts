import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  Reading,
  TariffConfig,
  SyncLog,
  InboxPdf,
  SyncTrigger,
} from "@/lib/calc/types";
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
  status: string | null;
  origin: string | null;
  created_at: string;
  updated_at: string;
};

type TariffRow = {
  id: number;
  energy_rate_vt?: number;
  energy_rate_nt?: number;
  energy_rate_jt?: number;
  overage_multiplier?: number;
  overage_threshold_kwh?: number;
  fixed_fee?: number;
  metering_fee?: number;
  transmission_rate?: number;
  distribution_rate_vt?: number;
  distribution_rate_nt?: number;
  oie_rate?: number;
  vat_rate?: number;
};

const READING_ROWS =
  "id,period_start,period_end,hep_vt_kwh,hep_nt_kwh,hep_total_supply,hep_fees,hep_grand_total,upper_vt_kwh,upper_nt_kwh,status,origin,created_at,updated_at";

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
    ...(row.status ? { status: row.status as Reading["status"] } : {}),
    ...(row.origin ? { origin: row.origin as Reading["origin"] } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toTariff(row: TariffRow): Partial<TariffConfig> {
  return {
    ...(row.energy_rate_vt !== undefined && { energyRateVt: row.energy_rate_vt }),
    ...(row.energy_rate_nt !== undefined && { energyRateNt: row.energy_rate_nt }),
    ...(row.energy_rate_jt !== undefined && { energyRateJt: row.energy_rate_jt }),
    ...(row.overage_multiplier !== undefined && {
      overageMultiplier: row.overage_multiplier,
    }),
    ...(row.overage_threshold_kwh !== undefined && {
      overageThresholdKwh: row.overage_threshold_kwh,
    }),
    ...(row.fixed_fee !== undefined && { fixedFee: row.fixed_fee }),
    ...(row.metering_fee !== undefined && { meteringFee: row.metering_fee }),
    ...(row.transmission_rate !== undefined && {
      transmissionRate: row.transmission_rate,
    }),
    ...(row.distribution_rate_vt !== undefined && {
      distributionRateVt: row.distribution_rate_vt,
    }),
    ...(row.distribution_rate_nt !== undefined && {
      distributionRateNt: row.distribution_rate_nt,
    }),
    ...(row.oie_rate !== undefined && { oieRate: row.oie_rate }),
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
    input: {
      periodStart: string;
      periodEnd: string;
      hepVtKwh?: number;
      hepNtKwh?: number;
      hepTotalSupply?: number;
      hepFees?: number;
      hepGrandTotal?: number;
      upperVtKwh?: number;
      upperNtKwh?: number;
      sourcePdfId?: string;
      sourcePdfName?: string;
      origin?: Readonly<Reading>["origin"];
    },
  ): Promise<Reading> {
    const { data, error } = await this.client
      .from("readings")
      .insert({
        period_start: input.periodStart,
        period_end: input.periodEnd,
        hep_vt_kwh: input.hepVtKwh ?? 0,
        hep_nt_kwh: input.hepNtKwh ?? 0,
        hep_total_supply: input.hepTotalSupply ?? 0,
        hep_fees: input.hepFees ?? 0,
        hep_grand_total: input.hepGrandTotal ?? 0,
        upper_vt_kwh: input.upperVtKwh ?? 0,
        upper_nt_kwh: input.upperNtKwh ?? 0,
        source_pdf_id: input.sourcePdfId ?? null,
        source_pdf_name: input.sourcePdfName ?? null,
        status: computeSupabaseStatus(input),
        origin: input.origin ?? (input.sourcePdfId ? "parsed" : "manual"),
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
        status: computeSupabaseStatus(input as Reading),
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
      energy_rate_jt: config.energyRateJt,
      overage_multiplier: config.overageMultiplier,
      overage_threshold_kwh: config.overageThresholdKwh,
      fixed_fee: config.fixedFee,
      metering_fee: config.meteringFee,
      transmission_rate: config.transmissionRate,
      distribution_rate_vt: config.distributionRateVt,
      distribution_rate_nt: config.distributionRateNt,
      oie_rate: config.oieRate,
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

  // ---- settings ----------------------------------------------------------

  async getSetting(key: string): Promise<string | null> {
    const { data, error } = await this.client
      .from("settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error && error.code !== "PGRST116") throw new Error(error.message);
    return (data as { value: string } | null)?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    const { error } = await this.client
      .from("settings")
      .upsert({ key, value }, { onConflict: "key" });
    if (error) throw new Error(error.message);
  }

  // ---- Gmail OAuth -------------------------------------------------------

  async getOAuthState(): Promise<{ refreshToken?: string } | null> {
    const { data, error } = await this.client
      .from("gmail_oauth")
      .select("refresh_token")
      .eq("id", 1)
      .maybeSingle();
    if (error && error.code !== "PGRST116") throw new Error(error.message);
    const row = data as { refresh_token: string | null } | null;
    return row?.refresh_token ? { refreshToken: row.refresh_token } : null;
  }

  async setOAuthState(state: { refreshToken: string }): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.client.from("gmail_oauth").upsert(
      { id: 1, refresh_token: state.refreshToken, created_at: now, updated_at: now },
      { onConflict: "id" },
    );
    if (error) throw new Error(error.message);
  }

  async clearOAuthState(): Promise<void> {
    const { error } = await this.client.from("gmail_oauth").delete().eq("id", 1);
    if (error) throw new Error(error.message);
  }

  // ---- sync logs ---------------------------------------------------------

  async addSyncLog(
    log: Omit<SyncLog, "id" | "timestamp">,
  ): Promise<SyncLog> {
    const now = new Date().toISOString();
    const { data, error } = await this.client
      .from("sync_logs")
      .insert({
        ok: log.ok,
        found: log.found,
        message_id: log.messageId ?? null,
        downloaded_file: log.downloadedFile ?? null,
        error: log.error ?? null,
        status: log.status,
        trigger: log.trigger,
        timestamp: now,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return rowToSyncLog(data);
  }

  async listSyncLogs(limit = 50): Promise<SyncLog[]> {
    const { data, error } = await this.client
      .from("sync_logs")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []).map(rowToSyncLog);
  }

  async clearSyncLogs(): Promise<void> {
    const { error } = await this.client.from("sync_logs").delete().neq("id", "");
    if (error) throw new Error(error.message);
  }

  // ---- inbox PDFs --------------------------------------------------------

  async addInboxPdf(
    pdf: Omit<InboxPdf, "id" | "downloadedAt">,
  ): Promise<InboxPdf> {
    const now = new Date().toISOString();
    const { data, error } = await this.client
      .from("inbox_pdfs")
      .insert({
        filename: pdf.filename,
        path: pdf.path,
        msg_id: pdf.msgId ?? null,
        parsed_at: pdf.parsedAt ?? null,
        reading_id: pdf.readingId ?? null,
        parse_preview: pdf.parsePreview ? JSON.stringify(pdf.parsePreview) : null,
        downloaded_at: now,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return rowToInboxPdf(data);
  }

  async listInboxPdfs(): Promise<InboxPdf[]> {
    const { data, error } = await this.client
      .from("inbox_pdfs")
      .select("*")
      .order("downloaded_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(rowToInboxPdf);
  }

  async getInboxPdf(id: string): Promise<InboxPdf | null> {
    const { data, error } = await this.client
      .from("inbox_pdfs")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowToInboxPdf(data) : null;
  }

  async updateInboxPdf(
    id: string,
    patch: Partial<InboxPdf>,
  ): Promise<InboxPdf | null> {
    const { data, error } = await this.client
      .from("inbox_pdfs")
      .update({
        ...(patch.filename !== undefined && { filename: patch.filename }),
        ...(patch.path !== undefined && { path: patch.path }),
        ...(patch.msgId !== undefined && { msg_id: patch.msgId }),
        ...(patch.parsedAt !== undefined && { parsed_at: patch.parsedAt }),
        ...(patch.readingId !== undefined && { reading_id: patch.readingId }),
        ...(patch.parsePreview !== undefined && {
          parse_preview: JSON.stringify(patch.parsePreview),
        }),
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowToInboxPdf(data) : null;
  }

  async deleteInboxPdf(id: string): Promise<boolean> {
    const { data, error } = await this.client
      .from("inbox_pdfs")
      .delete()
      .eq("id", id)
      .select("id");
    if (error) throw new Error(error.message);
    return (data?.length ?? 0) > 0;
  }

  async deleteInboxByMsgId(msgId: string): Promise<number> {
    const { data, error } = await this.client
      .from("inbox_pdfs")
      .delete()
      .eq("msg_id", msgId)
      .select("id");
    if (error) throw new Error(error.message);
    return data?.length ?? 0;
  }
}

function rowToSyncLog(r: Record<string, unknown>): SyncLog {
  return {
    id: r.id as string,
    timestamp: r.timestamp as string,
    ok: !!r.ok,
    found: !!r.found,
    messageId: (r.message_id as string | null) ?? undefined,
    downloadedFile: (r.downloaded_file as string | null) ?? undefined,
    error: (r.error as string | null) ?? undefined,
    status: r.status as string,
    trigger: r.trigger as SyncTrigger,
  };
}

function rowToInboxPdf(r: Record<string, unknown>): InboxPdf {
  return {
    id: r.id as string,
    filename: r.filename as string,
    path: r.path as string,
    msgId: (r.msg_id as string | null) ?? undefined,
    downloadedAt: r.downloaded_at as string,
    parsedAt: (r.parsed_at as string | null) ?? undefined,
    readingId: (r.reading_id as string | null) ?? undefined,
    parsePreview: r.parse_preview
      ? (JSON.parse(r.parse_preview as string) as InboxPdf["parsePreview"])
      : undefined,
  };
}

function computeSupabaseStatus(r: {
  hepVtKwh?: number;
  hepNtKwh?: number;
  hepTotalSupply?: number;
  hepFees?: number;
  hepGrandTotal?: number;
  upperVtKwh?: number;
  upperNtKwh?: number;
}): Reading["status"] {
  const hasInvoice =
    Number(r.hepVtKwh) > 0 ||
    Number(r.hepNtKwh) > 0 ||
    Number(r.hepGrandTotal) > 0 ||
    Number(r.hepTotalSupply) > 0 ||
    Number(r.hepFees) > 0;
  const hasUpper = Number(r.upperVtKwh) > 0 || Number(r.upperNtKwh) > 0;
  return hasInvoice && hasUpper ? "complete" : "pending";
}

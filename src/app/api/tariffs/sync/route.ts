import { NextResponse } from "next/server";

import { resolveTariffConfig } from "@/lib/pricing-baseline";
import { loadSettings } from "@/lib/settings";
import { StorageService } from "@/lib/storage-service";

/**
 * "Sync official prices": resolve the tariff for the selected HEP household
 * model (default Bijeli) — either from a configured JSON source URL or the
 * embedded per-model baseline — and save it to the tariff config.
 */
export async function POST() {
  try {
    const settings = await loadSettings();
    const storage = StorageService.getInstance();
    const model = settings.hepSync.tariffModel || "Bijeli";

    const { tariffs, source } = await resolveTariffConfig(
      model,
      settings.hepSync.sourceUrl,
      settings.hepSync.useBaselineFallback,
    );

    await storage.setTariffConfig(tariffs);

    return NextResponse.json({
      ok: true,
      source,
      model,
      tariffs,
      message: `Applied tariffs for the ${model} model (${source}).`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to sync tariffs." },
      { status: 500 },
    );
  }
}

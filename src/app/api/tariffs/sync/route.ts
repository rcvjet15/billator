import { NextResponse } from "next/server";

import { PRICE_BASELINE, fetchPricingFromUrl } from "@/lib/pricing-baseline";
import { loadSettings } from "@/lib/settings";
import { StorageService } from "@/lib/storage-service";

/**
 * "Sync official prices": tries the configured HEP source URL first, then
 * falls back to the bundled baseline template. Updates the tariff config.
 */
export async function POST() {
  try {
    const settings = await loadSettings();
    const storage = StorageService.getInstance();

    let applied = PRICE_BASELINE;
    let source = "baseline";

    if (settings.hepSync.sourceUrl) {
      const fetched = await fetchPricingFromUrl(settings.hepSync.sourceUrl);
      if (fetched) {
        applied = fetched;
        source = settings.hepSync.sourceUrl;
      } else if (!settings.hepSync.useBaselineFallback) {
        return NextResponse.json(
          { error: "Could not fetch pricing from the configured URL." },
          { status: 422 },
        );
      }
    }

    await storage.setTariffConfig(applied);

    return NextResponse.json({
      ok: true,
      source,
      tariffs: applied,
      message: source === "baseline" ? "Applied baseline template." : "Applied fetched prices.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to sync tariffs." },
      { status: 500 },
    );
  }
}

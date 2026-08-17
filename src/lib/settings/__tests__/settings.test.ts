import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SecretStore } from "@/lib/security/secret";
import { PRICE_BASELINE, fetchPricingFromUrl } from "@/lib/pricing-baseline";

describe("SecretStore", () => {
  const original = process.env.GMAIL_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.GMAIL_ENCRYPTION_KEY = "a".repeat(32);
    // Force a fresh instance so it re-reads the key.
    (SecretStore as unknown as { _instance: null })._instance = null;
  });

  it("round-trips encryption", () => {
    const store = SecretStore.getInstance();
    expect(SecretStore.isConfigured()).toBe(true);
    const plain = "super-secret-refresh-token";
    const enc = store.encrypt(plain);
    expect(enc.startsWith("enc:v1:")).toBe(true);
    expect(store.decrypt(enc)).toBe(plain);
  });

  afterEach(() => {
    process.env.GMAIL_ENCRYPTION_KEY = original;
  });
});

describe("pricing baseline", () => {
  it("exports a complete tariff config", () => {
    expect(PRICE_BASELINE.energyRateVt).toBeGreaterThan(0);
    expect(PRICE_BASELINE.overageThresholdKwh).toBe(3000);
    expect(PRICE_BASELINE.overageMultiplier).toBeCloseTo(1.35, 2);
  });

  it("returns null when no URL is configured", async () => {
    expect(await fetchPricingFromUrl("")).toBeNull();
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { SqliteAdapter } from "@/lib/storage/sqlite-adapter";

describe("SqliteAdapter", () => {
  let adapter: SqliteAdapter;

  beforeAll(() => {
    adapter = new SqliteAdapter(":memory:");
  });

  afterAll(() => {
    adapter.close();
  });

  it("creates and lists readings", async () => {
    const r = await adapter.createReading({
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      hepVtKwh: 100,
      hepNtKwh: 50,
      hepTotalSupply: 20,
      hepFees: 5,
      hepGrandTotal: 25,
      upperVtKwh: 10,
      upperNtKwh: 5,
      sourcePdfId: "pdf-1",
      sourcePdfName: "july.PDF",
    });
    expect(r.id).toBeTruthy();
    expect(r.sourcePdfId).toBe("pdf-1");
    const list = await adapter.listReadings();
    expect(list).toHaveLength(1);
    expect(list[0]?.hepVtKwh).toBe(100);
  });

  it("stores and reads settings", async () => {
    await adapter.setSetting("app.gmail.enabled", "true");
    expect(await adapter.getSetting("app.gmail.enabled")).toBe("true");
  });

  it("stores gmail oauth state", async () => {
    await adapter.setOAuthState({ refreshToken: "tok123" });
    expect((await adapter.getOAuthState())?.refreshToken).toBe("tok123");
  });

  it("adds and lists sync logs", async () => {
    await adapter.addSyncLog({
      ok: true,
      found: false,
      status: "No new bills",
      trigger: "sync",
    });
    await adapter.addSyncLog({
      ok: true,
      found: true,
      downloadedFile: "data/inbox/test.pdf",
      status: "Downloaded",
      trigger: "manual",
    });
    const logs = await adapter.listSyncLogs();
    expect(logs).toHaveLength(2);
    expect(logs.some((l) => l.downloadedFile === "data/inbox/test.pdf")).toBe(true);
    expect(logs.some((l) => l.status === "No new bills")).toBe(true);
  });

  it("adds and lists inbox pdfs", async () => {
    await adapter.addInboxPdf({
      filename: "test.PDF",
      path: "data/inbox/test.PDF",
      msgId: "m1",
    });
    const pdfs = await adapter.listInboxPdfs();
    expect(pdfs).toHaveLength(1);
    expect(pdfs[0]?.filename).toBe("test.PDF");
  });

  it("stores tariff config via settings", async () => {
    await adapter.setTariffConfig({ energyRateVt: 0.2 });
    const cfg = await adapter.getTariffConfig();
    expect(cfg?.energyRateVt).toBe(0.2);
  });

  it("creates, lists and updates payments", async () => {
    const p = await adapter.createPayment({
      billId: "reading-1",
      amount: 58.78,
      method: "Revolut",
      recipient: "myrevtag",
      note: "electricity 2026-04",
    });
    expect(p.id).toBeTruthy();
    expect(p.status).toBe("initiated");

    const list = await adapter.listPayments();
    expect(list).toHaveLength(1);
    expect(list[0]?.amount).toBe(58.78);

    const updated = await adapter.updatePayment(p.id, { status: "paid" });
    expect(updated?.status).toBe("paid");

    const deleted = await adapter.deletePayment(p.id);
    expect(deleted).toBe(true);
    expect(await adapter.getPayment(p.id)).toBeNull();
  });
});

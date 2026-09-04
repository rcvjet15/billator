import { describe, expect, it } from "vitest";

import {
  buildKeksUrl,
  buildRevolutUrl,
  formatAmount,
} from "@/lib/pay/links";
import type { PaymentsSettings } from "@/lib/settings/types";

const base: PaymentsSettings = {
  keksRecipient: "0911234567",
  keksTemplate: "kekspay://pay?amount={amount}&note={note}&recipient={recipient}",
  revolutUsername: "myhandle",
  revolutTemplate: "https://revolut.me/{username}/{currency}{amount}/{note}",
  revolutCurrency: "eur",
  defaultMethod: "Revolut",
};

describe("formatAmount", () => {
  it("formats to two decimals", () => {
    expect(formatAmount(58.7)).toBe("58.70");
    expect(formatAmount(124.987)).toBe("124.99");
  });
});

describe("buildRevolutUrl", () => {
  it("builds the community-tested path form", () => {
    const url = buildRevolutUrl({
      amount: 124.99,
      note: "electricity July",
      recipient: "",
      settings: base,
    });
    expect(url).toBe("https://revolut.me/myhandle/eur124.99/electricity_july");
  });

  it("overrides the default recipient with the modal value", () => {
    const url = buildRevolutUrl({
      amount: 10,
      note: "",
      recipient: "OtherUser",
      settings: base,
    });
    expect(url).toBe("https://revolut.me/OtherUser/eur10.00/");
  });

  it("respects a custom template", () => {
    const url = buildRevolutUrl({
      amount: 5,
      note: "",
      recipient: "",
      settings: { ...base, revolutTemplate: "https://revolut.me/{username}/{amount}" },
    });
    expect(url).toBe("https://revolut.me/myhandle/5.00");
  });
});

describe("buildKeksUrl", () => {
  it("builds the default kekspay deep link", () => {
    const url = buildKeksUrl({
      amount: 33.4,
      note: "kwjuli 2026",
      recipient: "",
      settings: base,
    });
    expect(url).toBe(
      "kekspay://pay?amount=33.40&note=kwjuli%202026&recipient=0911234567",
    );
  });

  it("uses the modal recipient override", () => {
    const url = buildKeksUrl({
      amount: 11,
      note: "",
      recipient: "Plus0987654321",
      settings: base,
    });
    expect(url).toContain("recipient=Plus0987654321");
  });
});

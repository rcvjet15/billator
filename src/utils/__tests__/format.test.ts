import { describe, expect, it } from "vitest";

import { formatDate, formatDateWithTime } from "@/utils/format";

describe("formatDate (dd.MM.yyyy)", () => {
  it("formats an ISO date string", () => {
    expect(formatDate("2026-07-01")).toBe("01.07.2026");
  });

  it("formats a Date object", () => {
    expect(formatDate(new Date(2026, 6, 1))).toBe("01.07.2026");
  });

  it("formats with time (dd.MM.yyyy HH:mm)", () => {
    expect(formatDateWithTime(new Date(2026, 6, 1, 9, 5))).toBe("01.07.2026 09:05");
  });
});

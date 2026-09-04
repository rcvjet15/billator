import { describe, expect, it } from "vitest";
import { inReminderWindow, monthKey } from "@/lib/reminders/reminder.worker";

describe("reminder.worker window helpers", () => {
  // new Date(year, monthIndex-1, day)
  const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

  it("is within the window on the 1st", () => {
    expect(inReminderWindow(d(2026, 4, 1), 3)).toBe(true);
  });

  it("is within the window through checkDays", () => {
    expect(inReminderWindow(d(2026, 4, 3), 3)).toBe(true);
  });

  it("is outside the window after checkDays", () => {
    expect(inReminderWindow(d(2026, 4, 4), 3)).toBe(false);
  });

  it("returns a zero-padded month key", () => {
    expect(monthKey(d(2026, 3, 5))).toBe("2026-03");
    expect(monthKey(d(2026, 12, 31))).toBe("2026-12");
  });
});

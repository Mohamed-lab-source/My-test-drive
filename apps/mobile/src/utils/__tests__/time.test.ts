import { describe, expect, it } from "vitest";
import { isInQuietHours, moveOutOfQuietHours, quietAdjustedTime } from "../quietHours";
import { cookDaysInWeek, weekNumber, weekStartKey } from "../week";
import { daysSince, formatClock } from "../recipeBadges";

const night = { enabled: true, startHour: 22, endHour: 7 };
const at = (h: number, m = 0) => new Date(2026, 9, 19, h, m);

describe("quiet hours", () => {
  it("handles windows that wrap past midnight", () => {
    expect(isInQuietHours(at(21), night)).toBe(false);
    expect(isInQuietHours(at(23), night)).toBe(true);
    expect(isInQuietHours(at(3), night)).toBe(true);
    expect(isInQuietHours(at(7), night)).toBe(false);
  });

  it("moves late-evening reminders to the next morning and early ones to this morning", () => {
    const late = moveOutOfQuietHours(at(23, 30), night);
    expect([late.getDate(), late.getHours(), late.getMinutes()]).toEqual([20, 7, 0]);
    const early = moveOutOfQuietHours(at(2), night);
    expect([early.getDate(), early.getHours()]).toEqual([19, 7]);
    expect(moveOutOfQuietHours(at(12), night).getHours()).toBe(12);
  });

  it("does nothing when disabled", () => {
    expect(isInQuietHours(at(23), { ...night, enabled: false })).toBe(false);
  });

  it("shifts a recurring time out of the window", () => {
    expect(quietAdjustedTime(18, 0, { enabled: true, startHour: 17, endHour: 20 })).toEqual({ hour: 20, minute: 0 });
    expect(quietAdjustedTime(10, 30, night)).toEqual({ hour: 10, minute: 30 });
  });
});

describe("weeks start on Saturday", () => {
  const d = (s: string) => new Date(`${s}T12:00:00Z`);

  it("finds the Saturday that starts the week", () => {
    expect(weekStartKey(d("2026-10-19"))).toBe("2026-10-17"); // Monday
    expect(weekStartKey(d("2026-10-17"))).toBe("2026-10-17"); // Saturday itself
    expect(weekStartKey(d("2026-10-16"))).toBe("2026-10-10"); // Friday belongs to the week before
  });

  it("counts cook days only inside that week", () => {
    const log = ["2026-10-16", "2026-10-17", "2026-10-19", "2026-10-23", "2026-10-24"];
    expect(cookDaysInWeek(log, d("2026-10-19"))).toBe(3);
  });

  it("gives every day of a week the same week number", () => {
    expect(weekNumber(d("2026-10-17"))).toBe(weekNumber(d("2026-10-23")));
    expect(weekNumber(d("2026-10-24")) - weekNumber(d("2026-10-23"))).toBe(1);
  });
});

describe("clock and day helpers", () => {
  it("formats 12-hour times in both languages", () => {
    expect(formatClock(at(19, 5), "en")).toBe("7:05 PM");
    expect(formatClock(at(0, 30), "en")).toBe("12:30 AM");
    expect(formatClock(at(9, 0), "ar")).toBe("9:00 ص");
  });

  it("counts whole days since a date and never goes negative", () => {
    const now = new Date(Date.UTC(2026, 9, 19, 10));
    expect(daysSince("2026-10-19", now)).toBe(0);
    expect(daysSince("2026-10-16", now)).toBe(3);
    expect(daysSince("2026-10-25", now)).toBe(0);
  });
});

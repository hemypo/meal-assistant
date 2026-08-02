import { describe, expect, it } from "vitest";
import {
  addDays,
  dayOfMonth,
  longDate,
  startOfWeek,
  weekDays,
  weekdayLabel,
  weekRangeLabel,
} from "./dates";

describe("week boundaries", () => {
  it("treats Monday as the start of the week", () => {
    // 2026-08-05 is a Wednesday.
    expect(startOfWeek("2026-08-05")).toBe("2026-08-03");
  });

  it("keeps Monday itself unchanged", () => {
    expect(startOfWeek("2026-08-03")).toBe("2026-08-03");
  });

  it("puts Sunday at the END of its week, not the start", () => {
    // The classic off-by-one: getUTCDay() returns 0 for Sunday.
    expect(startOfWeek("2026-08-09")).toBe("2026-08-03");
  });

  it("returns seven consecutive days", () => {
    expect(weekDays("2026-08-03")).toEqual([
      "2026-08-03",
      "2026-08-04",
      "2026-08-05",
      "2026-08-06",
      "2026-08-07",
      "2026-08-08",
      "2026-08-09",
    ]);
  });
});

describe("date arithmetic crosses boundaries safely", () => {
  it("crosses a month end", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
  });

  it("crosses a year end", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("handles a leap day", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("steps backwards across a month start", () => {
    expect(addDays("2026-08-01", -1)).toBe("2026-07-31");
  });
});

describe("no timezone drift", () => {
  it("keeps the day number stable regardless of local offset", () => {
    // Parsing as UTC is what stops a user behind UTC seeing the previous day.
    expect(dayOfMonth("2026-08-03")).toBe(3);
    expect(weekdayLabel("2026-08-03")).toBe("ПН");
    expect(weekdayLabel("2026-08-09")).toBe("ВС");
  });
});

describe("Russian formatting (MASTER.md §6)", () => {
  it("uses genitive month names", () => {
    expect(longDate("2026-08-02")).toBe("2 августа");
    expect(longDate("2026-01-15")).toBe("15 января");
  });

  it("renders a week range", () => {
    expect(weekRangeLabel("2026-07-27")).toBe("27 июля — 2 августа");
  });
});

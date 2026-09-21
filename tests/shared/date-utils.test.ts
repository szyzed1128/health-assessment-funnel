import { describe, expect, it } from "vitest";

import {
  getTargetDateBounds,
  isValidIsoDate,
} from "@/shared/date-utils";

describe("date utilities", () => {
  it("calculates a current-date-relative target window", () => {
    expect(getTargetDateBounds(new Date("2026-09-22T12:00:00.000Z"))).toEqual({
      min: "2026-10-06",
      max: "2028-09-21",
    });
  });

  it.each([
    ["2024-02-29", true],
    ["2026-02-28", true],
    ["2026-02-29", false],
    ["2026-02-31", false],
    ["2026-09-31", false],
    ["2026-13-01", false],
  ])("validates real calendar dates: %s", (value, expected) => {
    expect(isValidIsoDate(value)).toBe(expected);
  });
});

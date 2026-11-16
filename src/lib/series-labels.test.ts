import { expect, test } from "vitest";

import { ordinal, repeatsLabel } from "./series-labels.ts";

test("writes a day of the month as it is said", () => {
  expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 30, 31].map(ordinal)).toEqual([
    "1st",
    "2nd",
    "3rd",
    "4th",
    "11th",
    "12th",
    "13th",
    "21st",
    "22nd",
    "23rd",
    "30th",
    "31st",
  ]);
});

test("names a weekly rule by the weekday the series starts on", () => {
  // 2026-11-06 is a Friday.
  const friday = { dayOfMonth: null, startDate: "2026-11-06" };
  expect(repeatsLabel({ ...friday, everyWeeks: 1 })).toBe(
    "Every week on Friday",
  );
  expect(repeatsLabel({ ...friday, everyWeeks: 4 })).toBe(
    "Every 4 weeks on Friday",
  );
});

test("names a monthly rule by its day, whatever day the series starts on", () => {
  expect(
    repeatsLabel({ everyWeeks: null, dayOfMonth: 31, startDate: "2026-11-06" }),
  ).toBe("Monthly on the 31st");
});

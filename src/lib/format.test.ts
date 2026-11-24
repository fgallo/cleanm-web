import { expect, test } from "vitest";

import { formatDuration } from "./format.ts";

test("writes a stretch of time in hours and minutes", () => {
  expect([45, 60, 75, 67, 180, 1].map(formatDuration)).toEqual([
    "45 min",
    "1 h",
    "1 h 15 min",
    "1 h 7 min",
    "3 h",
    "1 min",
  ]);
});

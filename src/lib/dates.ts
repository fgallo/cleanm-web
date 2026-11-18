import { Temporal } from "temporal-polyfill";

import type { DateRange } from "@/api/jobs.ts";

// A day written as YYYY-MM-DD, the way URLs and the API carry it, or `null`
// when the text is not a day of the calendar ("tomorrow", "2026-02-30").
export function parseDay(value: string): Temporal.PlainDate | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  try {
    return Temporal.PlainDate.from(value);
  } catch {
    return null;
  }
}

// A month written as YYYY-MM, the way a URL carries it, or `null` when the
// text is not a month of the calendar ("2026-13"). A whole day is not one
// either, though `Temporal` would read its month.
export function parseMonth(value: string): Temporal.PlainYearMonth | null {
  if (!/^\d{4}-\d{2}$/.test(value)) {
    return null;
  }
  try {
    return Temporal.PlainYearMonth.from(value);
  } catch {
    return null;
  }
}

// A month as the API takes a range of days: its first and its last, both
// included.
export function monthRange(month: Temporal.PlainYearMonth): DateRange {
  return {
    from: month.toPlainDate({ day: 1 }).toString(),
    to: month.toPlainDate({ day: month.daysInMonth }).toString(),
  };
}

import { Temporal } from "temporal-polyfill";

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

import { Temporal } from "temporal-polyfill";

import type { SeriesRule } from "@/api/recurring-series.ts";
import { formatWeekday } from "@/lib/format.ts";

const ordinalRules = new Intl.PluralRules("en", { type: "ordinal" });
const ordinalSuffixes: Record<Intl.LDMLPluralRule, string> = {
  zero: "th",
  one: "st",
  two: "nd",
  few: "rd",
  many: "th",
  other: "th",
};

// "1st", "2nd", "3rd", "11th", "22nd": a day of the month as it is said.
export function ordinal(value: number): string {
  return `${value}${ordinalSuffixes[ordinalRules.select(value)]}`;
}

// How the rule of a series reads: "Every week on Tuesday", "Every 2 weeks
// on Tuesday", "Monthly on the 14th". A weekly rule falls on the weekday of
// the day the series starts.
export function repeatsLabel(
  series: SeriesRule & { startDate: string },
): string {
  if (series.dayOfMonth !== null) {
    return `Monthly on the ${ordinal(series.dayOfMonth)}`;
  }
  const weekday = formatWeekday(Temporal.PlainDate.from(series.startDate));
  return series.everyWeeks === 1
    ? `Every week on ${weekday}`
    : `Every ${series.everyWeeks} weeks on ${weekday}`;
}

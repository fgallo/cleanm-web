import type { Temporal } from "temporal-polyfill";

// One business, in Canada: the organization has no currency or locale yet.
// The API's invoice PDF makes the same assumption.
const locale = "en-CA";
const currency = "CAD";

const money = new Intl.NumberFormat(locale, { style: "currency", currency });
const quantity = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });

// Integer cents as "$135.00".
export function formatMoney(cents: number): string {
  return money.format(cents / 100);
}

// A duration in minutes as hours, "3 h" or "2.5 h": the business charges
// by the hour.
export function formatHours(minutes: number): string {
  return `${quantity.format(minutes / 60)} h`;
}

// "Tuesday, November 17, 2026".
export function formatDay(day: Temporal.PlainDate): string {
  return day.toLocaleString(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// "9:00 a.m.".
export function formatTime(time: Temporal.PlainTime): string {
  return time.toLocaleString(locale, { hour: "numeric", minute: "2-digit" });
}

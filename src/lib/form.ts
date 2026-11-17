// An optional field left blank is sent as `null`: the API takes no empty
// string for an optional field, and `null` clears it on an update.
export function emptyAsNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

// Money is typed in dollars ("45" or "45.50") and travels as integer cents.
// Rounding absorbs what binary fractions lose: 19.99 x 100 is 1998.99….
export function dollarsToCents(value: string): number {
  return Math.round(Number(value) * 100);
}

export function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

// A duration is typed in hours ("2.5") and travels as minutes.
export function hoursToMinutes(value: string): number {
  return Math.round(Number(value) * 60);
}

// Two decimals of an hour are within half a minute of any duration, so the
// field gives back the minutes it was filled from.
export function minutesToHours(minutes: number): string {
  return String(Math.round((minutes / 60) * 100) / 100);
}

// A percentage is typed as "10" or "12.5" and travels as basis points, a
// hundred to the percent.
export function percentToBasisPoints(value: string): number {
  return Math.round(Number(value) * 100);
}

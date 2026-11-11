// An optional field left blank is sent as `null`: the API takes no empty
// string for an optional field, and `null` clears it on an update.
export function emptyAsNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

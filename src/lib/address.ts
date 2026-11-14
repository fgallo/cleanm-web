// "Toronto, ON M4B 1B3". The country is shown only when it is not CA, the
// API's default: the first business is in Toronto.
export function cityLine({
  city,
  province,
  postalCode,
  country,
}: {
  city: string;
  province: string;
  postalCode: string;
  country: string;
}): string {
  const line = `${city}, ${province} ${postalCode}`;
  return country === "CA" ? line : `${line}, ${country}`;
}

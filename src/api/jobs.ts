import { queryOptions } from "@tanstack/react-query";

import { get } from "./client.ts";

export type ServiceType = "regular" | "deep" | "move_in" | "move_out";

export type JobStatus = "estimated" | "scheduled" | "completed" | "cancelled";

// The shape GET /jobs returns. A job is a slot on the organization's
// calendar, not an instant: `scheduledDate` is YYYY-MM-DD and `startTime`
// HH:MM:SS, both without a time zone (brief, design rule 4).
export type Job = {
  id: string;
  scheduledDate: string;
  startTime: string;
  durationMinutes: number;
  serviceType: ServiceType;
  status: JobStatus;
  hourlyRateCents: number;
  // An agreed price; when null, `priceCents` is hourly rate x duration.
  fixedPriceCents: number | null;
  priceCents: number;
  notes: string | null;
  property: {
    id: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    province: string;
    postalCode: string;
    country: string;
    notes: string | null;
  };
  client: { id: string; name: string };
  helper: { id: string; name: string } | null;
  recurringSeriesId: string | null;
  invoice: { id: string; number: number } | null;
  createdAt: string;
  updatedAt: string;
};

// Both dates are YYYY-MM-DD and inclusive, as GET /jobs takes them.
export type DateRange = { from: string; to: string };

export const jobKeys = {
  all: ["jobs"] as const,
  range: ({ from, to }: DateRange) =>
    [...jobKeys.all, "range", from, to] as const,
};

export function jobsQueryOptions(range: DateRange) {
  return queryOptions({
    queryKey: jobKeys.range(range),
    queryFn: () => get<Job[]>(`/jobs?from=${range.from}&to=${range.to}`),
  });
}

import { queryOptions } from "@tanstack/react-query";

import { get, patch } from "./client.ts";

export const serviceTypes = ["regular", "deep", "move_in", "move_out"] as const;
export type ServiceType = (typeof serviceTypes)[number];

export const jobStatuses = [
  "estimated",
  "scheduled",
  "completed",
  "cancelled",
] as const;
export type JobStatus = (typeof jobStatuses)[number];

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

// What can be changed on a job, as PATCH /jobs/:id takes it. The property
// is not here: it is chosen when the job is created and stays.
export type JobInput = {
  scheduledDate: string;
  // HH:MM, as a time field gives it; the API takes it with or without
  // seconds.
  startTime: string;
  durationMinutes: number;
  serviceType: ServiceType;
  status: JobStatus;
  hourlyRateCents: number;
  // `null` charges the hourly rate x the duration.
  fixedPriceCents: number | null;
  // `null` assigns nobody.
  helperId: string | null;
  notes: string | null;
};

// Both dates are YYYY-MM-DD and inclusive, as GET /jobs takes them.
export type DateRange = { from: string; to: string };

export const jobKeys = {
  all: ["jobs"] as const,
  // Every list of jobs, whatever its days: what a change to one job makes
  // stale, on the calendar and on the page of a day.
  ranges: () => [...jobKeys.all, "range"] as const,
  range: ({ from, to }: DateRange) => [...jobKeys.ranges(), from, to] as const,
  detail: (id: string) => [...jobKeys.all, "detail", id] as const,
};

export function jobsQueryOptions(range: DateRange) {
  return queryOptions({
    queryKey: jobKeys.range(range),
    queryFn: () => get<Job[]>(`/jobs?from=${range.from}&to=${range.to}`),
  });
}

export function jobQueryOptions(id: string) {
  return queryOptions({
    queryKey: jobKeys.detail(id),
    queryFn: () => get<Job>(`/jobs/${id}`),
  });
}

// A job as its form starts from it, and as an update is compared with it.
export function toJobInput(job: Job): JobInput {
  return {
    scheduledDate: job.scheduledDate,
    startTime: job.startTime.slice(0, 5),
    durationMinutes: job.durationMinutes,
    serviceType: job.serviceType,
    status: job.status,
    hourlyRateCents: job.hourlyRateCents,
    fixedPriceCents: job.fixedPriceCents,
    helperId: job.helper?.id ?? null,
    notes: job.notes,
  };
}

// Sends only the fields that differ from `job`. The API checks whatever it
// is sent: a job keeps a helper who became inactive, but assigning one is
// refused, so sending that helper back unchanged would fail the update.
export function updateJob(job: Job, input: JobInput): Promise<Job> {
  const current = toJobInput(job);
  const changes = Object.fromEntries(
    Object.entries(input).filter(
      ([field, value]) => value !== current[field as keyof JobInput],
    ),
  );
  // Nothing to ask of the API, which takes no empty update either.
  if (Object.keys(changes).length === 0) {
    return Promise.resolve(job);
  }
  return patch<Job>(`/jobs/${job.id}`, changes);
}

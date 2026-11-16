import { queryOptions } from "@tanstack/react-query";

import { get, patch, post } from "./client.ts";

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
  // `hourlyRateCents` is the helper's usual rate, what this job pays them
  // for an hour unless it carries a rate of its own.
  helper: { id: string; name: string; hourlyRateCents: number | null } | null;
  // What the helper is paid for an hour of this job when it is not their
  // usual rate. It belongs to the job: it stays when the helper changes.
  helperHourlyRateCents: number | null;
  recurringSeriesId: string | null;
  invoice: { id: string; number: number } | null;
  createdAt: string;
  updatedAt: string;
};

// What a job and a recurring series, the template of its jobs, have in
// common: when in the day, what it is, who helps and what it costs.
export type JobTemplate = {
  // HH:MM, as a time field gives it; the API takes it with or without
  // seconds.
  startTime: string;
  durationMinutes: number;
  serviceType: ServiceType;
  hourlyRateCents: number;
  // `null` charges the hourly rate x the duration.
  fixedPriceCents: number | null;
  // `null` assigns nobody.
  helperId: string | null;
  // `null` pays the helper their usual rate.
  helperHourlyRateCents: number | null;
  notes: string | null;
};

// What can be changed on a job, as PATCH /jobs/:id takes it. The property
// is not here: it is chosen when the job is created and stays.
export type JobInput = JobTemplate & {
  scheduledDate: string;
  status: JobStatus;
};

// Both dates are YYYY-MM-DD and inclusive, as GET /jobs takes them.
export type DateRange = { from: string; to: string };

export const jobKeys = {
  all: ["jobs"] as const,
  // Every list of jobs, whatever its days: what a change to one job makes
  // stale, on the calendar and on the page of a day.
  ranges: () => [...jobKeys.all, "range"] as const,
  range: ({ from, to }: DateRange) => [...jobKeys.ranges(), from, to] as const,
  // Every job fetched on its own: what a change to the series behind them
  // makes stale.
  details: () => [...jobKeys.all, "detail"] as const,
  detail: (id: string) => [...jobKeys.details(), id] as const,
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

// What POST /jobs takes: the same fields and the property the job is at.
export function createJob(
  input: JobInput & { propertyId: string },
): Promise<Job> {
  return post<Job>("/jobs", input);
}

// The template of a job, or of a series, as a form starts from it.
export function toJobTemplate(
  source: Pick<
    Job,
    | "startTime"
    | "durationMinutes"
    | "serviceType"
    | "hourlyRateCents"
    | "fixedPriceCents"
    | "helper"
    | "helperHourlyRateCents"
    | "notes"
  >,
): JobTemplate {
  return {
    startTime: source.startTime.slice(0, 5),
    durationMinutes: source.durationMinutes,
    serviceType: source.serviceType,
    hourlyRateCents: source.hourlyRateCents,
    fixedPriceCents: source.fixedPriceCents,
    helperId: source.helper?.id ?? null,
    helperHourlyRateCents: source.helperHourlyRateCents,
    notes: source.notes,
  };
}

// A job as its form starts from it, and as an update is compared with it.
export function toJobInput(job: Job): JobInput {
  return {
    scheduledDate: job.scheduledDate,
    status: job.status,
    ...toJobTemplate(job),
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

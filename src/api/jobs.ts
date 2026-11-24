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

// A helper on a job. `helper.hourlyRateCents` is their usual rate, and
// `hourlyRateCents` next to it what this job pays them for an hour when it
// is not the usual one. `payCents` is what the job pays them: the rate in
// effect for the time at the house, `null` while they have no rate.
export type AssignedHelper = {
  helper: { id: string; name: string; hourlyRateCents: number | null };
  hourlyRateCents: number | null;
  payCents: number | null;
};

// A helper as a request assigns them; `null` pays their usual rate.
export type HelperAssignment = {
  helperId: string;
  hourlyRateCents: number | null;
};

// The shape GET /jobs returns. A job is a slot on the organization's
// calendar, not an instant: `scheduledDate` is YYYY-MM-DD and `startTime`
// HH:MM:SS, both without a time zone (brief, design rule 4).
export type Job = {
  id: string;
  scheduledDate: string;
  startTime: string;
  // The hours of cleaning, which is what the client pays for. How long the
  // job takes at the house is `onSiteMinutes`.
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
  // The helpers who do the job, ordered by name; empty while none is
  // assigned.
  helpers: AssignedHelper[];
  // Whether the owner of the business works on the job, next to them.
  ownerWorks: boolean;
  // How many do the job, one while nobody is marked, and how long it takes
  // them at the house: the hours of cleaning shared between them. The API
  // works both out.
  people: number;
  onSiteMinutes: number;
  recurringSeriesId: string | null;
  invoice: { id: string; number: number } | null;
  createdAt: string;
  updatedAt: string;
};

// What a job and a recurring series, the template of its jobs, have in
// common: when in the day, what it is, who does it and what it costs.
export type JobTemplate = {
  // HH:MM, as a time field gives it; the API takes it with or without
  // seconds.
  startTime: string;
  durationMinutes: number;
  serviceType: ServiceType;
  hourlyRateCents: number;
  // `null` charges the hourly rate x the duration.
  fixedPriceCents: number | null;
  ownerWorks: boolean;
  // Sent as a whole: the list replaces the one the job had, and an empty
  // one assigns nobody.
  helpers: HelperAssignment[];
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
    | "ownerWorks"
    | "helpers"
    | "notes"
  >,
): JobTemplate {
  return {
    startTime: source.startTime.slice(0, 5),
    durationMinutes: source.durationMinutes,
    serviceType: source.serviceType,
    hourlyRateCents: source.hourlyRateCents,
    fixedPriceCents: source.fixedPriceCents,
    ownerWorks: source.ownerWorks,
    helpers: source.helpers.map((assigned) => ({
      helperId: assigned.helper.id,
      hourlyRateCents: assigned.hourlyRateCents,
    })),
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

// The fields of `input` that differ from `current`: what an update sends.
// The helpers are one field, the list as a whole: the same helpers at the
// same rates are no change, in whatever order.
export function changedFields<Input extends JobTemplate>(
  current: Input,
  input: Input,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([field, value]) =>
      field === "helpers"
        ? !sameHelpers(current.helpers, input.helpers)
        : value !== current[field as keyof Input],
    ),
  );
}

// A helper is on a list at most once, so two lists of one length are the
// same when each helper of one is on the other at the same rate.
function sameHelpers(
  one: HelperAssignment[],
  other: HelperAssignment[],
): boolean {
  return (
    one.length === other.length &&
    other.every((assignment) =>
      one.some(
        (candidate) =>
          candidate.helperId === assignment.helperId &&
          candidate.hourlyRateCents === assignment.hourlyRateCents,
      ),
    )
  );
}

// Sends only the fields that differ from `job`. The helpers travel as the
// whole list once any of them changed; the API takes in it a helper who
// became inactive, as long as the job already had them.
export function updateJob(job: Job, input: JobInput): Promise<Job> {
  const changes = changedFields(toJobInput(job), input);
  // Nothing to ask of the API, which takes no empty update either.
  if (Object.keys(changes).length === 0) {
    return Promise.resolve(job);
  }
  return patch<Job>(`/jobs/${job.id}`, changes);
}

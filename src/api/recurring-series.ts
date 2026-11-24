import { queryOptions } from "@tanstack/react-query";

import { del, get, patch, post } from "./client.ts";
import {
  changedFields,
  toJobTemplate,
  type Job,
  type JobTemplate,
  type ServiceType,
} from "./jobs.ts";

// When a series repeats. Exactly one of the two is set: every N weeks, on
// the weekday of `startDate`, or a day of the month (the last day of the
// months that are shorter).
export type SeriesRule =
  | { everyWeeks: number; dayOfMonth: null }
  | { everyWeeks: null; dayOfMonth: number };

// The shape GET /recurring-series returns: the rule, and the template of the
// jobs it generates ahead of time. Like a job's, its dates and its time have
// no time zone.
export type RecurringSeries = SeriesRule & {
  id: string;
  startDate: string;
  // The last day a visit can fall on; `null` while the series goes on.
  endDate: string | null;
  startTime: string;
  durationMinutes: number;
  serviceType: ServiceType;
  hourlyRateCents: number;
  fixedPriceCents: number | null;
  notes: string | null;
  property: Job["property"];
  client: Job["client"];
  // Who does a job as the series generates it, and what the API works out
  // from that, as on a job.
  helpers: Job["helpers"];
  ownerWorks: boolean;
  people: number;
  onSiteMinutes: number;
  createdAt: string;
  updatedAt: string;
};

// What can change on a series once it exists, as PATCH
// /recurring-series/:id takes it: when it ends and the template of its
// jobs. The rule, the first day and the property stay.
export type SeriesChanges = JobTemplate & {
  // `null` keeps the series going until it is ended.
  endDate: string | null;
};

// What the form of a new series holds: the rule and the first day as well.
// The property is not here: the page adds it.
export type SeriesInput = SeriesRule & SeriesChanges & { startDate: string };

export const seriesKeys = {
  all: ["recurring-series"] as const,
  list: () => [...seriesKeys.all, "list"] as const,
  detail: (id: string) => [...seriesKeys.all, "detail", id] as const,
};

// Every series of the organization, ordered by client and start date.
export const seriesListQueryOptions = queryOptions({
  queryKey: seriesKeys.list(),
  queryFn: () => get<RecurringSeries[]>("/recurring-series"),
});

export function seriesQueryOptions(id: string) {
  return queryOptions({
    queryKey: seriesKeys.detail(id),
    queryFn: () => get<RecurringSeries>(`/recurring-series/${id}`),
  });
}

// The API generates the first visits as it creates the series. It takes the
// half of the rule that is set, and no `null` for the other half.
export function createSeries({
  everyWeeks,
  dayOfMonth,
  ...rest
}: SeriesInput & { propertyId: string }): Promise<RecurringSeries> {
  return post<RecurringSeries>("/recurring-series", {
    ...rest,
    ...(dayOfMonth === null ? { everyWeeks } : { dayOfMonth }),
  });
}

// A series as its form starts from it, and as an update is compared with it.
export function toSeriesChanges(series: RecurringSeries): SeriesChanges {
  return { endDate: series.endDate, ...toJobTemplate(series) };
}

// Sends only the fields that differ from `series`, like `updateJob`. The API
// acts on whatever it is sent: an `endDate` removes the visits after it, and
// a template field that changed reaches the upcoming visits that still had
// the previous value. The helpers count as one field there too: the visits
// that still had the helpers the series had get the ones it has now.
export function updateSeries(
  series: RecurringSeries,
  input: SeriesChanges,
): Promise<RecurringSeries> {
  const changes = changedFields(toSeriesChanges(series), input);
  // Nothing to ask of the API, which takes no empty update either.
  if (Object.keys(changes).length === 0) {
    return Promise.resolve(series);
  }
  return patch<RecurringSeries>(`/recurring-series/${series.id}`, changes);
}

// Removes the series and its visits. The API refuses (`409`) once one of
// them was completed, cancelled or invoiced: such a series is ended instead.
export function deleteSeries(id: string): Promise<void> {
  return del(`/recurring-series/${id}`);
}

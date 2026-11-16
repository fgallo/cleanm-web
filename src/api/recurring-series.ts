import { queryOptions } from "@tanstack/react-query";

import { get, post } from "./client.ts";
import type { Job, JobTemplate, ServiceType } from "./jobs.ts";

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
  helper: Job["helper"];
  // What the generated jobs pay their helper when it is not the usual rate.
  helperHourlyRateCents: number | null;
  createdAt: string;
  updatedAt: string;
};

// What the form of a series holds: the rule, the days it runs between and
// the template of its jobs. The property is not here: it is chosen when the
// series is created and stays.
export type SeriesInput = SeriesRule &
  JobTemplate & {
    startDate: string;
    // `null` keeps the series going until it is ended.
    endDate: string | null;
  };

export const seriesKeys = {
  all: ["recurring-series"] as const,
  list: () => [...seriesKeys.all, "list"] as const,
};

// Every series of the organization, ordered by client and start date.
export const seriesListQueryOptions = queryOptions({
  queryKey: seriesKeys.list(),
  queryFn: () => get<RecurringSeries[]>("/recurring-series"),
});

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

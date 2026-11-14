import { queryOptions } from "@tanstack/react-query";

import { get, patch, post } from "./client.ts";

// The shape GET /helpers returns. A helper who left stays in the list with
// `active: false`: the jobs they did still name them, but the API refuses
// to assign them to a job.
export type Helper = {
  id: string;
  name: string;
  phone: string | null;
  // What the helper is paid for an hour of work; `null` when not set.
  hourlyRateCents: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

// What the helper form holds. `null` leaves an optional field empty on
// create and clears it on update.
export type HelperInput = {
  name: string;
  phone: string | null;
  hourlyRateCents: number | null;
  active: boolean;
};

export const helperKeys = {
  all: ["helpers"] as const,
  list: () => [...helperKeys.all, "list"] as const,
  detail: (id: string) => [...helperKeys.all, "detail", id] as const,
};

// Every helper of the organization, ordered by name.
export const helperListQueryOptions = queryOptions({
  queryKey: helperKeys.list(),
  queryFn: () => get<Helper[]>("/helpers"),
});

export function helperQueryOptions(id: string) {
  return queryOptions({
    queryKey: helperKeys.detail(id),
    queryFn: () => get<Helper>(`/helpers/${id}`),
  });
}

// A new helper is always active: POST /helpers takes no `active`.
export function createHelper({
  name,
  phone,
  hourlyRateCents,
}: HelperInput): Promise<Helper> {
  return post<Helper>("/helpers", { name, phone, hourlyRateCents });
}

export function updateHelper(id: string, input: HelperInput): Promise<Helper> {
  return patch<Helper>(`/helpers/${id}`, input);
}

import { queryOptions } from "@tanstack/react-query";

import { get } from "./client.ts";

// The shape GET /helpers returns. A helper who left stays in the list with
// `active: false`: the jobs they did still name them, but the API refuses
// to assign them to a job.
export type Helper = {
  id: string;
  name: string;
  phone: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export const helperKeys = {
  all: ["helpers"] as const,
  list: () => [...helperKeys.all, "list"] as const,
};

// Every helper of the organization, ordered by name.
export const helperListQueryOptions = queryOptions({
  queryKey: helperKeys.list(),
  queryFn: () => get<Helper[]>("/helpers"),
});

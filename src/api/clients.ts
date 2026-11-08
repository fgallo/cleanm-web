import { queryOptions } from "@tanstack/react-query";

import { get } from "./client.ts";

// The shape GET /clients returns. Dates travel as ISO strings.
export type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
};

// Every query about clients starts with `all`, so that invalidating it after
// a change refreshes the list and every detail at once.
export const clientKeys = {
  all: ["clients"] as const,
  list: () => [...clientKeys.all, "list"] as const,
  // Everything about one client hangs under this key: the client itself and
  // its properties (src/api/properties.ts).
  detail: (id: string) => [...clientKeys.all, "detail", id] as const,
};

export const clientListQueryOptions = queryOptions({
  queryKey: clientKeys.list(),
  queryFn: () => get<Client[]>("/clients"),
});

export function clientQueryOptions(id: string) {
  return queryOptions({
    queryKey: clientKeys.detail(id),
    queryFn: () => get<Client>(`/clients/${id}`),
  });
}

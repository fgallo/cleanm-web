import { queryOptions } from "@tanstack/react-query";

import { get } from "./client.ts";
import { clientKeys } from "./clients.ts";

// The shape GET /clients/:clientId/properties returns. `country` is an ISO
// 3166-1 alpha-2 code; the API defaults it to CA.
export type Property = {
  id: string;
  clientId: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export const propertyKeys = {
  // Under the client's detail key, so that invalidating the client refreshes
  // its properties as well.
  ofClient: (clientId: string) =>
    [...clientKeys.detail(clientId), "properties"] as const,
};

export function clientPropertiesQueryOptions(clientId: string) {
  return queryOptions({
    queryKey: propertyKeys.ofClient(clientId),
    queryFn: () => get<Property[]>(`/clients/${clientId}/properties`),
  });
}

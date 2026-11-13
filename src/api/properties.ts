import { queryOptions } from "@tanstack/react-query";

import { get, patch, post } from "./client.ts";
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

// What POST /clients/:clientId/properties and PATCH /properties/:id take.
// `null` leaves an optional field empty on create and clears it on update.
export type PropertyInput = {
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  notes: string | null;
};

export const propertyKeys = {
  // One property by its own id, as the API addresses it (/properties/:id).
  detail: (id: string) => ["properties", "detail", id] as const,
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

export function propertyQueryOptions(id: string) {
  return queryOptions({
    queryKey: propertyKeys.detail(id),
    queryFn: () => get<Property>(`/properties/${id}`),
  });
}

export function createProperty(
  clientId: string,
  input: PropertyInput,
): Promise<Property> {
  return post<Property>(`/clients/${clientId}/properties`, input);
}

export function updateProperty(
  id: string,
  input: PropertyInput,
): Promise<Property> {
  return patch<Property>(`/properties/${id}`, input);
}

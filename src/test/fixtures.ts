import type { Session } from "@/api/auth.ts";
import type { Client } from "@/api/clients.ts";
import type { Property } from "@/api/properties.ts";

// Invented, like the API's seed data.
export const session: Session = {
  user: {
    id: "0199c4b0-7d2e-7a10-8c3e-3f1c9a2b4d01",
    organizationId: "0199c4b0-7d2e-7a10-8c3e-3f1c9a2b4d00",
    email: "ana@example.com",
    name: "Ana Example",
  },
  organization: {
    id: "0199c4b0-7d2e-7a10-8c3e-3f1c9a2b4d00",
    name: "Example Cleaning",
    timezone: "America/Toronto",
  },
};

export const alice: Client = {
  id: "0199c4b0-7d2e-7a10-8c3e-3f1c9a2b4d10",
  name: "Alice Example",
  email: "alice@example.com",
  phone: "416-555-0101",
  createdAt: "2026-10-01T14:00:00.000Z",
  updatedAt: "2026-10-01T14:00:00.000Z",
};

export const bob: Client = {
  id: "0199c4b0-7d2e-7a10-8c3e-3f1c9a2b4d11",
  name: "Bob Sample",
  email: null,
  phone: null,
  createdAt: "2026-10-02T15:30:00.000Z",
  updatedAt: "2026-10-02T15:30:00.000Z",
};

export const clients: Client[] = [alice, bob];

export const aliceProperties: Property[] = [
  {
    id: "0199c4b0-7d2e-7a10-8c3e-3f1c9a2b4d20",
    clientId: alice.id,
    addressLine1: "456 Sample Ave",
    addressLine2: "Unit 2",
    city: "Toronto",
    province: "ON",
    postalCode: "M4B 1B3",
    country: "CA",
    notes: "Key under the mat. Two cats.",
    createdAt: "2026-10-01T14:05:00.000Z",
    updatedAt: "2026-10-01T14:05:00.000Z",
  },
  {
    id: "0199c4b0-7d2e-7a10-8c3e-3f1c9a2b4d21",
    clientId: alice.id,
    addressLine1: "12 Example Rd",
    addressLine2: null,
    city: "Buffalo",
    province: "NY",
    postalCode: "14201",
    country: "US",
    notes: null,
    createdAt: "2026-10-03T09:00:00.000Z",
    updatedAt: "2026-10-03T09:00:00.000Z",
  },
];

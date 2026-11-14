import type { Session } from "@/api/auth.ts";
import type { Client } from "@/api/clients.ts";
import type { Job } from "@/api/jobs.ts";
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

export const aliceUnit: Property = {
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
};

export const aliceHouse: Property = {
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
};

export const aliceProperties: Property[] = [aliceUnit, aliceHouse];

// Tuesday morning at Alice's unit: charged by the hour, nobody assigned,
// not invoiced.
export const aliceVisit: Job = {
  id: "0199c4b0-7d2e-7a10-8c3e-3f1c9a2b4d30",
  scheduledDate: "2026-11-17",
  startTime: "09:00:00",
  durationMinutes: 180,
  serviceType: "regular",
  status: "scheduled",
  hourlyRateCents: 4500,
  fixedPriceCents: null,
  priceCents: 13500,
  notes: null,
  property: {
    id: aliceUnit.id,
    addressLine1: aliceUnit.addressLine1,
    addressLine2: aliceUnit.addressLine2,
    city: aliceUnit.city,
    province: aliceUnit.province,
    postalCode: aliceUnit.postalCode,
    country: aliceUnit.country,
    notes: aliceUnit.notes,
  },
  client: { id: alice.id, name: alice.name },
  helper: null,
  recurringSeriesId: null,
  invoice: null,
  createdAt: "2026-11-01T14:00:00.000Z",
  updatedAt: "2026-11-01T14:00:00.000Z",
};

// The same afternoon at Bob's: an agreed price, a helper, already invoiced.
export const bobVisit: Job = {
  id: "0199c4b0-7d2e-7a10-8c3e-3f1c9a2b4d31",
  scheduledDate: "2026-11-17",
  startTime: "13:30:00",
  durationMinutes: 150,
  serviceType: "move_out",
  status: "completed",
  hourlyRateCents: 5000,
  fixedPriceCents: 20000,
  priceCents: 20000,
  notes: "Bring the long ladder.",
  property: {
    id: "0199c4b0-7d2e-7a10-8c3e-3f1c9a2b4d22",
    addressLine1: "78 Invented St",
    addressLine2: null,
    city: "Toronto",
    province: "ON",
    postalCode: "M5V 2T6",
    country: "CA",
    notes: null,
  },
  client: { id: bob.id, name: bob.name },
  helper: {
    id: "0199c4b0-7d2e-7a10-8c3e-3f1c9a2b4d40",
    name: "Carla Invented",
  },
  recurringSeriesId: null,
  invoice: { id: "0199c4b0-7d2e-7a10-8c3e-3f1c9a2b4d50", number: 12 },
  createdAt: "2026-11-02T16:00:00.000Z",
  updatedAt: "2026-11-17T21:10:00.000Z",
};

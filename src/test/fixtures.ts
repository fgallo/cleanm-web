import type { Session } from "@/api/auth.ts";
import type { Client } from "@/api/clients.ts";

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

export const clients: Client[] = [
  {
    id: "0199c4b0-7d2e-7a10-8c3e-3f1c9a2b4d10",
    name: "Alice Example",
    email: "alice@example.com",
    phone: "416-555-0101",
    createdAt: "2026-10-01T14:00:00.000Z",
    updatedAt: "2026-10-01T14:00:00.000Z",
  },
  {
    id: "0199c4b0-7d2e-7a10-8c3e-3f1c9a2b4d11",
    name: "Bob Sample",
    email: null,
    phone: null,
    createdAt: "2026-10-02T15:30:00.000Z",
    updatedAt: "2026-10-02T15:30:00.000Z",
  },
];

import type { Session } from "@/api/auth.ts";

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

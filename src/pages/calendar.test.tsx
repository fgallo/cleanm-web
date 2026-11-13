import { screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import type { Job } from "@/api/jobs.ts";
import { json, mockApi, networkFailure, routes } from "@/test/api.ts";
import { alice, aliceUnit, session } from "@/test/fixtures.ts";
import { renderApp } from "@/test/render.tsx";

// Only the clock is replaced, so the calendar opens on a known month while
// timers and promises run as usual.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 10, 12, 10) });
});
afterEach(() => {
  vi.useRealTimers();
});

const visit: Job = {
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

test("shows the jobs of the month on screen", async () => {
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /jobs": () => json(200, [visit]),
    }),
  );
  renderApp({ route: "/calendar" });

  expect(await screen.findByText("Alice Example")).toBeDefined();
  expect(screen.getByText("November 2026")).toBeDefined();
  // The six weeks a month view always shows, from the Sunday on or before
  // the 1st, both ends inclusive.
  expect(requests.find((r) => r.path === "/jobs")?.url).toBe(
    "http://api.test/jobs?from=2026-11-01&to=2026-12-12",
  );
});

test("keeps the calendar and offers to try again when jobs fail to load", async () => {
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /jobs": () => networkFailure(),
    }),
  );
  renderApp({ route: "/calendar" });

  expect((await screen.findByRole("alert")).textContent).toContain(
    "Could not reach the API",
  );
  expect(screen.getByRole("button", { name: "Try again" })).toBeDefined();
  expect(screen.getByText("November 2026")).toBeDefined();
});

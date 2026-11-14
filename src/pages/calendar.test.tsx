import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { json, mockApi, networkFailure, routes } from "@/test/api.ts";
import { aliceVisit, session } from "@/test/fixtures.ts";
import { renderApp } from "@/test/render.tsx";

// Only the clock is replaced, so the calendar opens on a known month while
// timers and promises run as usual.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 10, 12, 10) });
});
afterEach(() => {
  vi.useRealTimers();
});

test("shows the jobs of the month on screen", async () => {
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /jobs": () => json(200, [aliceVisit]),
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

test("opens the day of a job that is clicked", async () => {
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /jobs": () => json(200, [aliceVisit]),
    }),
  );
  renderApp({ route: "/calendar" });

  fireEvent.click(await screen.findByText("Alice Example"));

  expect(
    await screen.findByRole("heading", { name: "Tuesday, November 17, 2026" }),
  ).toBeDefined();
  expect(requests.at(-1)?.url).toBe(
    "http://api.test/jobs?from=2026-11-17&to=2026-11-17",
  );
});

test("opens a day from its number, jobs or not", async () => {
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /jobs": () => json(200, []),
    }),
  );
  renderApp({ route: "/calendar" });

  fireEvent.click(await screen.findByRole("link", { name: /November 20/ }));

  expect(
    await screen.findByRole("heading", { name: "Friday, November 20, 2026" }),
  ).toBeDefined();
});

test("opens on the month of the day it is sent back from", async () => {
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /jobs": () => json(200, []),
    }),
  );
  renderApp({ route: "/calendar/2027-01-05" });

  fireEvent.click(
    await screen.findByRole("link", { name: "Back to calendar" }),
  );

  expect(await screen.findByText("January 2027")).toBeDefined();
  expect(requests.at(-1)?.url).toBe(
    "http://api.test/jobs?from=2026-12-27&to=2027-02-06",
  );
});

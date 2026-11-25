import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { json, mockApi, networkFailure, routes } from "@/test/api.ts";
import { aliceVisit, bobVisit, session } from "@/test/fixtures.ts";
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

test("marks the jobs that have an invoice", async () => {
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /jobs": () => json(200, [aliceVisit, bobVisit]),
    }),
  );
  renderApp({ route: "/calendar" });

  // The mark sits next to the name of the client it is about, and its title
  // says which invoice. It is found by that title, not by its role:
  // FullCalendar keeps an event of the month hidden until it has measured
  // where it goes, which jsdom never lets it do, and what is hidden has no
  // accessible name.
  const invoiced = (await screen.findByText("Bob Sample"))
    .parentElement as HTMLElement;
  const mark = within(invoiced).getByTitle("Invoice #12");
  expect(mark.parentElement?.getAttribute("role")).toBe("img");
  // Alice's visit has no invoice, and no mark.
  expect(screen.getAllByTitle(/Invoice/)).toEqual([mark]);
});

test("gives a job the room of its time at the house", async () => {
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /jobs": () => json(200, [aliceVisit, bobVisit]),
    }),
  );
  renderApp({ route: "/calendar?date=2026-11-17" });

  await screen.findByText("Bob Sample");
  // The week is where a job has a height, and says when it is over.
  fireEvent.click(screen.getByRole("tab", { name: "Week view" }));

  // The time of an event is written before the name of its client, with
  // thin spaces around the dash: plain ones here.
  const timeOf = async (client: string) =>
    (
      await screen.findByText(client)
    ).parentElement?.previousElementSibling?.textContent.replace(/\s/g, " ");
  // The owner alone is there for the 3 hours of cleaning.
  expect(await timeOf("Alice Example")).toBe("9:00am – 12:00pm");
  // Two people do Bob's 2.5 hours in 1h15, not until 4:00.
  expect(await timeOf("Bob Sample")).toBe("1:30 – 2:45pm");
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

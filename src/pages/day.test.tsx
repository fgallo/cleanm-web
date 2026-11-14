import { fireEvent, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";

import { json, mockApi, networkFailure, routes } from "@/test/api.ts";
import { alice, aliceVisit, bobVisit, session } from "@/test/fixtures.ts";
import { renderApp } from "@/test/render.tsx";

// The card of the job whose client has this name.
function cardOf(client: string): HTMLElement {
  const card = screen.getByRole("heading", { name: client }).closest("li");
  if (card === null) {
    throw new Error(`No job card for ${client}`);
  }
  return card;
}

test("lists the jobs of a day with what each visit needs", async () => {
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /jobs": () => json(200, [aliceVisit, bobVisit]),
    }),
  );
  renderApp({ route: "/calendar/2026-11-17" });

  expect(
    await screen.findByRole("heading", { name: "Tuesday, November 17, 2026" }),
  ).toBeDefined();
  // A day is a range that starts and ends on it.
  expect(requests.find((r) => r.path === "/jobs")?.url).toBe(
    "http://api.test/jobs?from=2026-11-17&to=2026-11-17",
  );

  await screen.findByRole("heading", { name: "Alice Example" });
  const morning = within(cardOf("Alice Example"));
  expect(morning.getByText("9:00 a.m. – 12:00 p.m.")).toBeDefined();
  expect(morning.getByText("Scheduled")).toBeDefined();
  expect(morning.getByText("456 Sample Ave")).toBeDefined();
  expect(morning.getByText("Unit 2")).toBeDefined();
  expect(morning.getByText("Toronto, ON M4B 1B3")).toBeDefined();
  expect(morning.getByText("Key under the mat. Two cats.")).toBeDefined();
  expect(morning.getByText("Regular")).toBeDefined();
  expect(morning.getByText("No helper")).toBeDefined();
  expect(morning.getByText("3 h")).toBeDefined();
  // Charged by the hour: the rate is what explains the price.
  expect(morning.getByText("Price").nextElementSibling?.textContent).toBe(
    "$135.00 at $45.00 an hour",
  );
  expect(morning.getByText("Not invoiced")).toBeDefined();
  expect(
    morning.getByRole("link", { name: "Alice Example" }).getAttribute("href"),
  ).toBe(`/clients/${alice.id}`);

  const afternoon = within(cardOf("Bob Sample"));
  expect(afternoon.getByText("1:30 p.m. – 4:00 p.m.")).toBeDefined();
  expect(afternoon.getByText("Completed")).toBeDefined();
  expect(afternoon.getByText("Move-out")).toBeDefined();
  expect(afternoon.getByText("Carla Invented")).toBeDefined();
  expect(afternoon.getByText("2.5 h")).toBeDefined();
  expect(afternoon.getByText("Price").nextElementSibling?.textContent).toBe(
    "$200.00 agreed price",
  );
  expect(afternoon.getByText("#12")).toBeDefined();
  expect(afternoon.getByText("Bring the long ladder.")).toBeDefined();
});

test("says when a day has no jobs and moves to the days around it", async () => {
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /jobs": () => json(200, []),
    }),
  );
  renderApp({ route: "/calendar/2026-11-30" });

  expect(await screen.findByText("No jobs on this day.")).toBeDefined();

  // Across the end of the month: the day is a calendar date, not a number.
  fireEvent.click(screen.getByRole("link", { name: "Next day" }));
  expect(
    await screen.findByRole("heading", { name: "Tuesday, December 1, 2026" }),
  ).toBeDefined();
  expect(await screen.findByText("No jobs on this day.")).toBeDefined();
  expect(requests.at(-1)?.url).toBe(
    "http://api.test/jobs?from=2026-12-01&to=2026-12-01",
  );

  fireEvent.click(screen.getByRole("link", { name: "Previous day" }));
  expect(
    await screen.findByRole("heading", { name: "Monday, November 30, 2026" }),
  ).toBeDefined();
});

test("says when the address is not a day, without asking the API", async () => {
  const requests = mockApi(
    routes({ "GET /auth/me": () => json(200, session) }),
  );
  renderApp({ route: "/calendar/2026-02-30" });

  expect((await screen.findByRole("alert")).textContent).toBe("Day not found.");
  expect(screen.getByRole("link", { name: "Back to calendar" })).toBeDefined();
  expect(requests.map((r) => r.path)).toEqual(["/auth/me"]);
});

test("offers to try again when the jobs of a day fail to load", async () => {
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /jobs": () => networkFailure(),
    }),
  );
  renderApp({ route: "/calendar/2026-11-17" });

  expect((await screen.findByRole("alert")).textContent).toContain(
    "Could not reach the API",
  );
  expect(screen.getByRole("button", { name: "Try again" })).toBeDefined();
  expect(
    screen.getByRole("heading", { name: "Tuesday, November 17, 2026" }),
  ).toBeDefined();
});

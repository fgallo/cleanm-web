import { fireEvent, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";

import { json, mockApi, networkFailure, routes } from "@/test/api.ts";
import {
  alice,
  aliceVisit,
  bobVisit,
  carla,
  dan,
  doneBy,
  session,
} from "@/test/fixtures.ts";
import { renderApp } from "@/test/render.tsx";

// The card of the job whose client has this name.
function cardOf(client: string): HTMLElement {
  const card = screen.getByRole("heading", { name: client }).closest("li");
  if (card === null) {
    throw new Error(`No job card for ${client}`);
  }
  return card;
}

// What a job card says next to a label.
function detailOf(client: string, label: string): Element {
  const detail = within(cardOf(client)).getByText(label).nextElementSibling;
  if (detail === null) {
    throw new Error(`No ${label} on the job card for ${client}`);
  }
  return detail;
}

// Who does the job of this client, one line each.
function whoOf(client: string): Array<string | null> {
  return Array.from(
    detailOf(client, "Who").querySelectorAll("li"),
    (line) => line.textContent,
  );
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
  // The owner alone: at the house for the hours of cleaning.
  expect(whoOf("Alice Example")).toEqual(["Owner"]);
  expect(detailOf("Alice Example", "Hours").textContent).toBe("3 h");
  // Charged by the hour: the rate is what explains the price.
  expect(morning.getByText("Price").nextElementSibling?.textContent).toBe(
    "$135.00 at $45.00 an hour",
  );
  // A scheduled visit with no invoice yet: one is on offer.
  expect(morning.getByText("Invoice").nextElementSibling?.textContent).toBe(
    "Not invoiced · Generate invoice",
  );
  expect(
    morning
      .getByRole("link", { name: "Generate invoice for Alice Example" })
      .getAttribute("href"),
  ).toBe(`/jobs/${aliceVisit.id}/invoice/new`);
  expect(
    morning.getByRole("link", { name: "Alice Example" }).getAttribute("href"),
  ).toBe(`/clients/${alice.id}`);

  const afternoon = within(cardOf("Bob Sample"));
  // Two people: the visit lasts half of its hours of cleaning.
  expect(afternoon.getByText("1:30 p.m. – 2:45 p.m.")).toBeDefined();
  expect(afternoon.getByText("Completed")).toBeDefined();
  expect(afternoon.getByText("Move-out")).toBeDefined();
  // Her usual rate, the job has none for her, for the time at the house.
  expect(whoOf("Bob Sample")).toEqual([
    "Owner",
    "Carla Invented at $22.50 an hour, $28.13 for the job",
  ]);
  expect(detailOf("Bob Sample", "Hours").textContent).toBe(
    "2.5 h shared by 2 people, 1 h 15 min at the house",
  );
  expect(afternoon.getByText("Price").nextElementSibling?.textContent).toBe(
    "$200.00 agreed price",
  );
  expect(afternoon.getByText("#12")).toBeDefined();
  expect(afternoon.getByText("Bring the long ladder.")).toBeDefined();
});

test("shows who does each job and what each helper is paid for it", async () => {
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /jobs": () =>
        json(200, [
          // Dan goes without the owner. He has no usual rate, and the job
          // has none for him.
          doneBy(aliceVisit, [dan], { ownerWorks: false }),
          // The job's own rate for Carla, in place of her usual $22.50,
          // with Dan and the owner: three people.
          doneBy(bobVisit, [{ helper: carla, hourlyRateCents: 2500 }, dan]),
        ]),
    }),
  );
  renderApp({ route: "/calendar/2026-11-17" });

  await screen.findByRole("heading", { name: "Alice Example" });
  expect(whoOf("Alice Example")).toEqual(["Dan Former"]);
  expect(
    within(cardOf("Alice Example")).getByText("9:00 a.m. – 12:00 p.m."),
  ).toBeDefined();
  expect(detailOf("Alice Example", "Hours").textContent).toBe("3 h");
  // 2.5 hours between three: 50 minutes each.
  expect(whoOf("Bob Sample")).toEqual([
    "Owner",
    "Carla Invented at $25.00 an hour, $20.83 for the job",
    "Dan Former",
  ]);
  expect(
    within(cardOf("Bob Sample")).getByText("1:30 p.m. – 2:20 p.m."),
  ).toBeDefined();
  expect(detailOf("Bob Sample", "Hours").textContent).toBe(
    "2.5 h shared by 3 people, 50 min at the house",
  );
});

test("says when nobody is assigned to a job", async () => {
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /jobs": () =>
        json(200, [doneBy(aliceVisit, [], { ownerWorks: false })]),
    }),
  );
  renderApp({ route: "/calendar/2026-11-17" });

  await screen.findByRole("heading", { name: "Alice Example" });
  expect(detailOf("Alice Example", "Who").textContent).toBe("Nobody assigned");
  // Still one person's time: whoever goes is there for all of the hours.
  expect(
    within(cardOf("Alice Example")).getByText("9:00 a.m. – 12:00 p.m."),
  ).toBeDefined();
});

test("offers no invoice for an estimate or for a job that was cancelled", async () => {
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /jobs": () =>
        json(200, [
          { ...aliceVisit, status: "estimated" },
          { ...bobVisit, status: "cancelled", invoice: null },
        ]),
    }),
  );
  renderApp({ route: "/calendar/2026-11-17" });

  await screen.findByRole("heading", { name: "Alice Example" });
  for (const client of ["Alice Example", "Bob Sample"]) {
    expect(
      within(cardOf(client)).getByText("Invoice").nextElementSibling
        ?.textContent,
    ).toBe("Not invoiced");
  }
  expect(screen.queryByRole("link", { name: /Generate invoice/ })).toBeNull();
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

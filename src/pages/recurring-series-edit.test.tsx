import { fireEvent, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import type { Job } from "@/api/jobs.ts";
import type { RecurringSeries } from "@/api/recurring-series.ts";
import { apiError, json, mockApi, noContent, routes } from "@/test/api.ts";
import {
  aliceBiweekly,
  aliceVisit,
  bobMonthly,
  carla,
  dan,
  doneBy,
  helpers,
  session,
} from "@/test/fixtures.ts";
import { renderApp } from "@/test/render.tsx";

afterEach(() => {
  vi.useRealTimers();
});

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function valueOf(label: string): string {
  return screen.getByLabelText<Control>(label).value;
}

function save() {
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
}

function click(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

const seriesPath = `/recurring-series/${aliceBiweekly.id}`;

test("edits the template of a series from the list and sends only what changed", async () => {
  const longer: RecurringSeries = doneBy(
    { ...aliceBiweekly, durationMinutes: 210, hourlyRateCents: 5000 },
    [carla],
  );
  let saved = false;
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /recurring-series": () =>
        json(200, [saved ? longer : aliceBiweekly, bobMonthly]),
      [`GET ${seriesPath}`]: () => json(200, aliceBiweekly),
      "GET /helpers": () => json(200, helpers),
      [`PATCH ${seriesPath}`]: () => {
        saved = true;
        return json(200, longer);
      },
    }),
  );
  renderApp({ route: "/recurring-series" });

  fireEvent.click(
    await screen.findByRole("link", {
      name: "Edit series for Alice Example, 456 Sample Ave",
    }),
  );
  await screen.findByLabelText("Ends");
  // What a series keeps is said, not offered as fields.
  expect(screen.getByText("Alice Example · 456 Sample Ave")).toBeDefined();
  expect(
    screen.getByText(
      "Every 2 weeks on Tuesday, from Nov 3, 2026. To change how often it repeats, end this series and add another.",
    ),
  ).toBeDefined();
  expect(screen.queryByLabelText("Repeats")).toBeNull();
  expect(screen.queryByLabelText("Starts")).toBeNull();
  // The form starts from the series, in hours and dollars.
  expect(valueOf("Ends")).toBe("");
  // Nothing to clear on a series that goes on.
  expect(screen.queryByRole("button", { name: "Clear end date" })).toBeNull();
  expect(valueOf("Start time")).toBe("09:00");
  expect(valueOf("Hours")).toBe("3");
  expect(valueOf("Service")).toBe("regular");
  expect(valueOf("Hourly rate")).toBe("45.00");
  expect(
    screen.getByRole<HTMLInputElement>("checkbox", { name: "Carla Invented" })
      .checked,
  ).toBe(true);

  fill("Hours", "3.5");
  fill("Hourly rate", "50");
  save();

  // Back on the list, which shows the change.
  expect(
    await screen.findByRole("heading", { name: "Recurring series" }),
  ).toBeDefined();
  expect(await screen.findByText("9:00 a.m. · 3.5 h")).toBeDefined();
  expect(requests.find((r) => r.method === "PATCH")?.body).toStrictEqual({
    durationMinutes: 210,
    hourlyRateCents: 5000,
  });
});

test("ends a series, on a later day when a visit after the first is invoiced", async () => {
  const refusal =
    "Cannot end the series on that date: a later visit is already invoiced. Delete its invoice or choose a later endDate.";
  const ended: RecurringSeries = { ...aliceBiweekly, endDate: "2026-12-01" };
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /recurring-series": () => json(200, [ended]),
      [`GET ${seriesPath}`]: () => json(200, aliceBiweekly),
      "GET /helpers": () => json(200, helpers),
      [`PATCH ${seriesPath}`]: (request) =>
        (request.body as { endDate: string }).endDate < "2026-11-17"
          ? apiError(409, "conflict", refusal)
          : json(200, ended),
    }),
  );
  renderApp({ route: `${seriesPath}/edit` });

  await screen.findByLabelText("Ends");
  // The browser refuses an end before the first day.
  expect(screen.getByLabelText("Ends").getAttribute("min")).toBe("2026-11-03");
  fill("Ends", "2026-11-10");
  save();

  // The API says why, and nothing was changed: the form stays as typed.
  expect((await screen.findByRole("alert")).textContent).toBe(refusal);
  expect(valueOf("Ends")).toBe("2026-11-10");
  fill("Ends", "2026-12-01");
  save();

  expect(await screen.findByText("Dec 1, 2026")).toBeDefined();
  expect(
    requests.filter((r) => r.method === "PATCH").map((r) => r.body),
  ).toStrictEqual([{ endDate: "2026-11-10" }, { endDate: "2026-12-01" }]);
});

test("resumes an ended series without sending its inactive helper again", async () => {
  // Dan left the business; the series he was on still has him.
  const dans: RecurringSeries = doneBy(bobMonthly, [dan]);
  const resumed: RecurringSeries = { ...dans, endDate: null };
  const path = `/recurring-series/${dans.id}`;
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /recurring-series": () => json(200, [resumed]),
      [`GET ${path}`]: () => json(200, dans),
      "GET /helpers": () => json(200, helpers),
      [`PATCH ${path}`]: () => json(200, resumed),
    }),
  );
  renderApp({ route: `${path}/edit` });

  await screen.findByLabelText("Ends");
  expect(
    screen.getByText(
      "Monthly on the 14th, from May 14, 2026. To change how often it repeats, end this series and add another.",
    ),
  ).toBeDefined();
  expect(valueOf("Ends")).toBe("2026-10-14");
  expect(valueOf("Agreed price")).toBe("200.00");
  expect(
    screen.getByRole<HTMLInputElement>("checkbox", {
      name: "Dan Former (inactive)",
    }).checked,
  ).toBe(true);
  click("Clear end date");
  expect(valueOf("Ends")).toBe("");
  save();

  expect(
    await screen.findByRole("heading", { name: "Recurring series" }),
  ).toBeDefined();
  expect(requests.find((r) => r.method === "PATCH")?.body).toStrictEqual({
    endDate: null,
  });
});

test("changes who does the visits of a series", async () => {
  // Carla takes the visits over: without the owner, at a rate of their own.
  const hers = doneBy(
    aliceBiweekly,
    [{ helper: carla, hourlyRateCents: 2500 }],
    { ownerWorks: false },
  );
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /recurring-series": () => json(200, [hers]),
      [`GET ${seriesPath}`]: () => json(200, aliceBiweekly),
      "GET /helpers": () => json(200, helpers),
      [`PATCH ${seriesPath}`]: () => json(200, hers),
    }),
  );
  renderApp({ route: `${seriesPath}/edit` });

  await screen.findByLabelText("Ends");
  // The form starts from who the series has.
  const owner = screen.getByRole<HTMLInputElement>("checkbox", {
    name: "Owner",
  });
  expect(owner.checked).toBe(true);
  expect(
    screen.getByRole<HTMLInputElement>("checkbox", { name: "Carla Invented" })
      .checked,
  ).toBe(true);
  expect(valueOf("Hourly rate of Carla Invented")).toBe("");
  expect(screen.getByText("2 people: 1 h 30 min at the house.")).toBeDefined();
  fireEvent.click(owner);
  fill("Hourly rate of Carla Invented", "25");
  expect(screen.getByText("1 person: 3 h at the house.")).toBeDefined();
  save();

  // Back on the list, which names who does the visits now.
  expect(
    await screen.findByRole("heading", { name: "Recurring series" }),
  ).toBeDefined();
  expect(requests.find((r) => r.method === "PATCH")?.body).toStrictEqual({
    ownerWorks: false,
    helpers: [{ helperId: carla.id, hourlyRateCents: 2500 }],
  });
});

test("returns to the list without asking the API when nothing changed", async () => {
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /recurring-series": () => json(200, [aliceBiweekly]),
      [`GET ${seriesPath}`]: () => json(200, aliceBiweekly),
      "GET /helpers": () => json(200, helpers),
    }),
  );
  renderApp({ route: `${seriesPath}/edit` });

  await screen.findByLabelText("Ends");
  save();

  expect(
    await screen.findByRole("heading", { name: "Recurring series" }),
  ).toBeDefined();
  expect(requests.some((r) => r.method === "PATCH")).toBe(false);
});

test("starts the form of a visit from what the series made of it", async () => {
  // The calendar opens on the month of the visit.
  vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 10, 12, 10) });
  const visit: Job = doneBy(
    { ...aliceVisit, recurringSeriesId: aliceBiweekly.id },
    [carla],
  );
  // What the API makes of the visit when the rate of its series changes.
  const dearer: Job = { ...visit, hourlyRateCents: 5000, priceCents: 15000 };
  let saved = false;
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /jobs": () => json(200, [saved ? dearer : visit]),
      [`GET /jobs/${visit.id}`]: () => json(200, saved ? dearer : visit),
      "GET /helpers": () => json(200, helpers),
      "GET /recurring-series": () => json(200, [aliceBiweekly]),
      [`GET ${seriesPath}`]: () => json(200, aliceBiweekly),
      [`PATCH ${seriesPath}`]: () => {
        saved = true;
        return json(200, { ...aliceBiweekly, hourlyRateCents: 5000 });
      },
    }),
  );
  renderApp({ route: `/jobs/${visit.id}/edit` });

  // The visit is read at the rate it had, then its series changes.
  await screen.findByLabelText("Hourly rate");
  expect(valueOf("Hourly rate")).toBe("45.00");
  fireEvent.click(screen.getByRole("link", { name: "recurring series" }));
  await screen.findByLabelText("Ends");
  fill("Hourly rate", "50");
  save();
  await screen.findByRole("heading", { name: "Recurring series" });

  // Back to the visit, through the calendar and its day.
  fireEvent.click(screen.getByRole("link", { name: "Calendar" }));
  fireEvent.click(await screen.findByText("Alice Example"));
  fireEvent.click(
    await screen.findByRole("link", { name: "Edit job for Alice Example" }),
  );

  await screen.findByLabelText("Hourly rate");
  expect(valueOf("Hourly rate")).toBe("50.00");
});

test("deletes a series after asking twice", async () => {
  let deleted = false;
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /recurring-series": () => json(200, deleted ? [] : [aliceBiweekly]),
      [`GET ${seriesPath}`]: () => json(200, aliceBiweekly),
      "GET /helpers": () => json(200, helpers),
      [`DELETE ${seriesPath}`]: () => {
        deleted = true;
        return noContent();
      },
    }),
  );
  renderApp({ route: `${seriesPath}/edit` });

  await screen.findByLabelText("Ends");
  click("Delete series");
  expect(screen.getByText("Delete it and its visits?")).toBeDefined();
  // Changing her mind costs nothing.
  click("Keep it");
  expect(screen.queryByText("Delete it and its visits?")).toBeNull();
  expect(requests.some((r) => r.method === "DELETE")).toBe(false);

  click("Delete series");
  click("Yes, delete");

  expect(await screen.findByText("No recurring series yet.")).toBeDefined();
  expect(requests.filter((r) => r.method === "DELETE")).toHaveLength(1);
});

test("says why a series cannot be deleted and keeps it", async () => {
  const refusal =
    "Cannot delete: some of its jobs were completed or cancelled. Set endDate instead.";
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      [`GET ${seriesPath}`]: () => json(200, aliceBiweekly),
      "GET /helpers": () => json(200, helpers),
      [`DELETE ${seriesPath}`]: () => apiError(409, "conflict", refusal),
    }),
  );
  renderApp({ route: `${seriesPath}/edit` });

  await screen.findByLabelText("Ends");
  click("Delete series");
  click("Yes, delete");

  expect((await screen.findByRole("alert")).textContent).toBe(refusal);
  // Still on the series, whose form is as it was.
  expect(screen.getByRole("heading", { name: "Edit series" })).toBeDefined();
  expect(valueOf("Hours")).toBe("3");
  click("Keep it");
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByRole("button", { name: "Delete series" })).toBeDefined();
});

test("says when the series to edit does not exist", async () => {
  const id = "0199c4b0-7d2e-7a10-8c3e-3f1c9a2b4d99";
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      [`GET /recurring-series/${id}`]: () =>
        apiError(404, "not_found", "Recurring series not found"),
      "GET /helpers": () => json(200, helpers),
    }),
  );
  renderApp({ route: `/recurring-series/${id}/edit` });

  expect((await screen.findByRole("alert")).textContent).toBe(
    "Series not found.",
  );
  expect(
    screen
      .getByRole("link", { name: "Back to recurring series" })
      .getAttribute("href"),
  ).toBe("/recurring-series");
  expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
});

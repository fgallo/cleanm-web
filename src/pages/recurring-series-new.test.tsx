import { fireEvent, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { json, mockApi, routes, validationError } from "@/test/api.ts";
import {
  alice,
  aliceBiweekly,
  aliceProperties,
  aliceUnit,
  bob,
  bobCottage,
  bobMonthly,
  carla,
  clients,
  helpers,
  session,
} from "@/test/fixtures.ts";
import { renderApp } from "@/test/render.tsx";

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function valueOf(label: string): string {
  return screen.getByLabelText<Control>(label).value;
}

function optionsOf(label: string): (string | null)[] {
  return Array.from(
    screen.getByLabelText<HTMLSelectElement>(label).options,
    (option) => option.textContent,
  );
}

function add() {
  fireEvent.click(screen.getByRole("button", { name: "Add series" }));
}

test("adds a series every two weeks from the list", async () => {
  let saved = false;
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /recurring-series": () => json(200, saved ? [aliceBiweekly] : []),
      "GET /clients": () => json(200, clients),
      "GET /helpers": () => json(200, helpers),
      [`GET /clients/${alice.id}/properties`]: () => json(200, aliceProperties),
      "POST /recurring-series": () => {
        saved = true;
        return json(201, aliceBiweekly);
      },
    }),
  );
  renderApp({ route: "/recurring-series" });

  fireEvent.click(await screen.findByRole("link", { name: "New series" }));
  await screen.findByLabelText("Client");
  // Nothing is guessed: how often and from when are chosen.
  expect(optionsOf("Repeats")).toEqual([
    "Choose how often",
    "Every week",
    "Every 2 weeks",
    "Every 3 weeks",
    "Every 4 weeks",
    "Every month",
  ]);
  expect(valueOf("Repeats")).toBe("");
  expect(valueOf("Starts")).toBe("");
  expect(valueOf("Ends")).toBe("");
  expect(valueOf("Service")).toBe("regular");

  fill("Client", alice.id);
  await screen.findByRole("option", {
    name: "456 Sample Ave, Unit 2, Toronto",
  });
  fill("Property", aliceUnit.id);
  fill("Repeats", "2");
  // The weekday is the one of the day the series starts on.
  expect(screen.getByText("On the weekday of the start date.")).toBeDefined();
  fill("Starts", "2026-11-03");
  expect(
    screen.getByText(
      "Every 2 weeks on Tuesday, the weekday of the start date.",
    ),
  ).toBeDefined();
  fill("Start time", "09:00");
  fill("Hours", "3");
  fill("Hourly rate", "45");
  fireEvent.click(screen.getByRole("checkbox", { name: "Carla Invented" }));
  // The owner with Carla, on every visit of the series.
  expect(screen.getByText("2 people: 1 h 30 min at the house.")).toBeDefined();
  // An end picked and taken back: the way to blank is next to the field,
  // whatever the browser's own picker offers.
  expect(screen.queryByRole("button", { name: "Clear end date" })).toBeNull();
  fill("Ends", "2027-04-19");
  fireEvent.click(screen.getByRole("button", { name: "Clear end date" }));
  expect(valueOf("Ends")).toBe("");
  expect(screen.queryByRole("button", { name: "Clear end date" })).toBeNull();
  add();

  // Back on the list, which shows the series.
  expect(
    await screen.findByRole("heading", { name: "Recurring series" }),
  ).toBeDefined();
  expect(await screen.findByText("Every 2 weeks on Tuesday")).toBeDefined();
  // Only the half of the rule that is set travels.
  expect(requests.find((r) => r.method === "POST")?.body).toStrictEqual({
    propertyId: aliceUnit.id,
    everyWeeks: 2,
    startDate: "2026-11-03",
    endDate: null,
    startTime: "09:00",
    durationMinutes: 180,
    serviceType: "regular",
    hourlyRateCents: 4500,
    fixedPriceCents: null,
    ownerWorks: true,
    helpers: [{ helperId: carla.id, hourlyRateCents: null }],
    notes: null,
  });
});

test("adds a series on a day of the month, with an end", async () => {
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /recurring-series": () => json(200, [bobMonthly]),
      "GET /clients": () => json(200, clients),
      "GET /helpers": () => json(200, helpers),
      [`GET /clients/${bob.id}/properties`]: () => json(200, [bobCottage]),
      "POST /recurring-series": () => json(201, bobMonthly),
    }),
  );
  renderApp({ route: "/recurring-series/new" });

  await screen.findByLabelText("Client");
  fill("Client", bob.id);
  // His only property is taken without asking.
  await screen.findByRole("option", { name: "78 Invented St, Toronto" });
  // The day of the month is asked only of a monthly series.
  fill("Repeats", "4");
  expect(screen.queryByLabelText("Day of the month")).toBeNull();
  fill("Repeats", "month");
  expect(
    screen.getByLabelText<HTMLInputElement>("Day of the month").required,
  ).toBe(true);
  expect(screen.getByText("Shorter months use their last day.")).toBeDefined();
  expect(
    screen.getByText(
      "Visits begin on that day of the month, from this date on.",
    ),
  ).toBeDefined();
  fill("Day of the month", "14");
  fill("Starts", "2026-05-01");
  // The browser refuses an end before the start.
  expect(screen.getByLabelText("Ends").getAttribute("min")).toBe("2026-05-01");
  fill("Ends", "2026-10-14");
  fill("Start time", "13:30");
  fill("Hours", "2.5");
  fill("Service", "deep");
  fill("Hourly rate", "50");
  fill("Agreed price", "200");
  fill("Notes about the job", "Bring the long ladder.");
  add();

  expect(await screen.findByText("Monthly on the 14th")).toBeDefined();
  expect(requests.find((r) => r.method === "POST")?.body).toStrictEqual({
    propertyId: bobCottage.id,
    dayOfMonth: 14,
    startDate: "2026-05-01",
    endDate: "2026-10-14",
    startTime: "13:30",
    durationMinutes: 150,
    serviceType: "deep",
    hourlyRateCents: 5000,
    fixedPriceCents: 20000,
    ownerWorks: true,
    helpers: [],
    notes: "Bring the long ladder.",
  });
});

test("sends no series while how often it repeats is not chosen", async () => {
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /clients": () => json(200, clients),
      "GET /helpers": () => json(200, helpers),
      [`GET /clients/${bob.id}/properties`]: () => json(200, [bobCottage]),
    }),
  );
  renderApp({ route: "/recurring-series/new" });

  await screen.findByLabelText("Client");
  fill("Client", bob.id);
  await screen.findByRole("option", { name: "78 Invented St, Toronto" });
  fill("Starts", "2026-11-03");
  fill("Start time", "09:00");
  fill("Hours", "3");
  fill("Hourly rate", "45");
  // The browser itself refuses a form whose required rule is empty.
  expect(
    screen.getByLabelText<HTMLSelectElement>("Repeats").validity.valueMissing,
  ).toBe(true);
  add();
  // A request would leave a moment after the click, not during it.
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(requests.some((r) => r.method === "POST")).toBe(false);
  expect(
    screen.getByRole("link", { name: "Cancel" }).getAttribute("href"),
  ).toBe("/recurring-series");
});

test("shows the API's issues under the series fields they name", async () => {
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /clients": () => json(200, clients),
      "GET /helpers": () => json(200, helpers),
      [`GET /clients/${bob.id}/properties`]: () => json(200, [bobCottage]),
      "POST /recurring-series": () =>
        validationError([
          { path: "endDate", message: "Must not be before startDate" },
          { path: "helpers.0.helperId", message: "Helper is not active" },
        ]),
    }),
  );
  renderApp({ route: "/recurring-series/new" });

  await screen.findByLabelText("Client");
  fill("Client", bob.id);
  await screen.findByRole("option", { name: "78 Invented St, Toronto" });
  fill("Repeats", "1");
  fill("Starts", "2026-11-06");
  fill("Start time", "09:00");
  fill("Hours", "3");
  fill("Hourly rate", "45");
  fireEvent.click(screen.getByRole("checkbox", { name: "Carla Invented" }));
  add();

  // One under the field of the form, one under a helper of the template.
  const alerts = await screen.findAllByRole("alert");
  expect(alerts.map((alert) => alert.textContent)).toEqual([
    "Must not be before startDate",
    "Helper is not active",
  ]);
  expect(screen.getByLabelText("Ends").getAttribute("aria-invalid")).toBe(
    "true",
  );
  expect(
    screen
      .getByRole("checkbox", { name: "Carla Invented" })
      .getAttribute("aria-invalid"),
  ).toBe("true");
  expect(screen.getByLabelText("Starts").getAttribute("aria-invalid")).toBe(
    "false",
  );
  // What was chosen stays, to be corrected and sent again.
  expect(valueOf("Repeats")).toBe("1");
  expect(valueOf("Starts")).toBe("2026-11-06");
});

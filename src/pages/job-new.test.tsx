import { fireEvent, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import type { Job } from "@/api/jobs.ts";
import { json, mockApi, routes, validationError } from "@/test/api.ts";
import {
  alice,
  aliceProperties,
  aliceUnit,
  aliceVisit,
  bob,
  bobCottage,
  carla,
  clients,
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

function optionsOf(label: string): (string | null)[] {
  return Array.from(
    screen.getByLabelText<HTMLSelectElement>(label).options,
    (option) => option.textContent,
  );
}

test("adds a job to a day, at a property of the client chosen", async () => {
  const created: Job = doneBy(
    {
      ...aliceVisit,
      id: "0199c4b0-7d2e-7a10-8c3e-3f1c9a2b4d32",
      scheduledDate: "2026-11-18",
      startTime: "14:00:00",
      durationMinutes: 150,
      serviceType: "deep",
      priceCents: 11250,
      notes: "First visit.",
    },
    [carla],
  );
  let saved = false;
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /jobs": () => json(200, saved ? [created] : []),
      "GET /clients": () => json(200, clients),
      "GET /helpers": () => json(200, helpers),
      [`GET /clients/${alice.id}/properties`]: () => json(200, aliceProperties),
      "POST /jobs": () => {
        saved = true;
        return json(201, created);
      },
    }),
  );
  renderApp({ route: "/calendar/2026-11-18" });

  fireEvent.click(await screen.findByRole("link", { name: "New job" }));
  await screen.findByLabelText("Client");
  // The day the job was asked from; scheduled and regular until changed.
  expect(valueOf("Date")).toBe("2026-11-18");
  expect(valueOf("Status")).toBe("scheduled");
  expect(valueOf("Service")).toBe("regular");
  expect(valueOf("Start time")).toBe("");
  expect(valueOf("Hours")).toBe("");
  expect(valueOf("Hourly rate")).toBe("");
  // No amount to show before there are hours and a rate.
  expect(screen.getByText("Blank charges by the hour.")).toBeDefined();
  // The owner alone until someone else is ticked, and no time at the house
  // before there are hours.
  expect(
    screen.getByRole<HTMLInputElement>("checkbox", { name: "Owner" }).checked,
  ).toBe(true);
  expect(
    screen.getByText("Hours of cleaning, shared by who does the job."),
  ).toBeDefined();
  expect(optionsOf("Property")).toEqual(["Choose a client first"]);

  fill("Client", alice.id);
  // Two properties: neither is picked for her.
  await screen.findByRole("option", {
    name: "456 Sample Ave, Unit 2, Toronto",
  });
  expect(optionsOf("Property")).toEqual([
    "Choose a property",
    "456 Sample Ave, Unit 2, Toronto",
    "12 Example Rd, Buffalo",
  ]);
  expect(valueOf("Property")).toBe("");
  fill("Property", aliceUnit.id);
  fill("Start time", "14:00");
  fill("Hours", "2.5");
  fill("Service", "deep");
  fill("Hourly rate", "45");
  expect(screen.getByText("Blank charges by the hour: $112.50.")).toBeDefined();
  expect(screen.getByText("1 person: 2 h 30 min at the house.")).toBeDefined();
  fireEvent.click(screen.getByRole("checkbox", { name: "Carla Invented" }));
  expect(screen.getByText("2 people: 1 h 15 min at the house.")).toBeDefined();
  fill("Notes about the job", "First visit.");
  fireEvent.click(screen.getByRole("button", { name: "Add job" }));

  expect(
    await screen.findByRole("heading", {
      name: "Wednesday, November 18, 2026",
    }),
  ).toBeDefined();
  expect(await screen.findByText("2:00 p.m. – 3:15 p.m.")).toBeDefined();
  expect(requests.find((r) => r.method === "POST")?.body).toEqual({
    propertyId: aliceUnit.id,
    status: "scheduled",
    scheduledDate: "2026-11-18",
    startTime: "14:00",
    durationMinutes: 150,
    serviceType: "deep",
    hourlyRateCents: 4500,
    fixedPriceCents: null,
    ownerWorks: true,
    helpers: [{ helperId: carla.id, hourlyRateCents: null }],
    notes: "First visit.",
  });
});

test("takes the only property of a client without asking", async () => {
  const created: Job = {
    ...aliceVisit,
    id: "0199c4b0-7d2e-7a10-8c3e-3f1c9a2b4d33",
    client: { id: bob.id, name: bob.name },
  };
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /jobs": () => json(200, [created]),
      "GET /clients": () => json(200, clients),
      "GET /helpers": () => json(200, helpers),
      [`GET /clients/${bob.id}/properties`]: () => json(200, [bobCottage]),
      "POST /jobs": () => json(201, created),
    }),
  );
  renderApp({ route: "/jobs/new?date=2026-11-17" });

  await screen.findByLabelText("Client");
  fill("Client", bob.id);
  await screen.findByRole("option", { name: "78 Invented St, Toronto" });
  expect(valueOf("Property")).toBe(bobCottage.id);
  fill("Start time", "09:00");
  fill("Hours", "3");
  fill("Hourly rate", "45");
  fill("Agreed price", "120");
  fireEvent.click(screen.getByRole("button", { name: "Add job" }));

  expect(
    await screen.findByRole("heading", { name: "Tuesday, November 17, 2026" }),
  ).toBeDefined();
  expect(requests.find((r) => r.method === "POST")?.body).toMatchObject({
    propertyId: bobCottage.id,
    fixedPriceCents: 12000,
    ownerWorks: true,
    helpers: [],
    notes: null,
  });
});

test("offers today, where the organization is, from the calendar", async () => {
  // 02:00 UTC on the 13th is still the evening of the 12th in Toronto.
  vi.useFakeTimers({
    toFake: ["Date"],
    now: new Date("2026-11-13T02:00:00Z"),
  });
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /jobs": () => json(200, []),
      "GET /clients": () => json(200, clients),
      "GET /helpers": () => json(200, helpers),
    }),
  );
  renderApp({ route: "/calendar" });

  fireEvent.click(await screen.findByRole("link", { name: "New job" }));

  await screen.findByLabelText("Client");
  expect(valueOf("Date")).toBe("2026-11-12");
  expect(
    screen.getByRole("link", { name: "Cancel" }).getAttribute("href"),
  ).toBe("/calendar");
});

test("says when the client has no property to hold a job", async () => {
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /clients": () => json(200, clients),
      "GET /helpers": () => json(200, helpers),
      [`GET /clients/${bob.id}/properties`]: () => json(200, []),
    }),
  );
  renderApp({ route: "/jobs/new?date=2026-11-17" });

  await screen.findByLabelText("Client");
  fill("Client", bob.id);

  expect(
    await screen.findByText(/This client has no property yet\./),
  ).toBeDefined();
  expect(
    screen.getByRole("link", { name: "Add a property" }).getAttribute("href"),
  ).toBe(`/clients/${bob.id}/properties/new`);
  // The browser itself refuses a form whose required property is empty.
  fill("Start time", "09:00");
  fill("Hours", "3");
  fill("Hourly rate", "45");
  expect(
    screen.getByLabelText<HTMLSelectElement>("Property").validity.valueMissing,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Add job" }));
  // A request would leave a moment after the click, not during it.
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(requests.some((r) => r.method === "POST")).toBe(false);
});

test("shows the API's issue about the property under its field, once", async () => {
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /clients": () => json(200, clients),
      "GET /helpers": () => json(200, helpers),
      [`GET /clients/${bob.id}/properties`]: () => json(200, [bobCottage]),
      "POST /jobs": () =>
        validationError([
          { path: "propertyId", message: "Property not found" },
        ]),
    }),
  );
  renderApp({ route: "/jobs/new?date=2026-11-17" });

  await screen.findByLabelText("Client");
  fill("Client", bob.id);
  await screen.findByRole("option", { name: "78 Invented St, Toronto" });
  fill("Start time", "09:00");
  fill("Hours", "3");
  fill("Hourly rate", "45");
  fireEvent.click(screen.getByRole("button", { name: "Add job" }));

  expect((await screen.findByRole("alert")).textContent).toBe(
    "Property not found",
  );
  expect(screen.getAllByRole("alert")).toHaveLength(1);
  expect(screen.getByLabelText("Property").getAttribute("aria-invalid")).toBe(
    "true",
  );
  expect(valueOf("Hours")).toBe("3");
});

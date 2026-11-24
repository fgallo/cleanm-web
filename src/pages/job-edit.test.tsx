import { fireEvent, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import type { Job } from "@/api/jobs.ts";
import {
  apiError,
  json,
  mockApi,
  routes,
  validationError,
} from "@/test/api.ts";
import {
  aliceBiweekly,
  aliceVisit,
  bobVisit,
  carla,
  dan,
  doneBy,
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

// The box that says whether this person does the job.
function box(name: string): HTMLInputElement {
  return screen.getByRole<HTMLInputElement>("checkbox", { name });
}

function save() {
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
}

test("edits a job from its day and sends only what changed", async () => {
  const done: Job = doneBy(
    {
      ...aliceVisit,
      status: "completed",
      durationMinutes: 210,
      priceCents: 15750,
    },
    [carla],
  );
  let saved = false;
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /jobs": () => json(200, [saved ? done : aliceVisit, bobVisit]),
      [`GET /jobs/${aliceVisit.id}`]: () => json(200, aliceVisit),
      "GET /helpers": () => json(200, helpers),
      [`PATCH /jobs/${aliceVisit.id}`]: () => {
        saved = true;
        return json(200, done);
      },
    }),
  );
  renderApp({ route: "/calendar/2026-11-17" });

  fireEvent.click(
    await screen.findByRole("link", { name: "Edit job for Alice Example" }),
  );
  await screen.findByLabelText("Status");
  expect(screen.getByText("Alice Example · 456 Sample Ave")).toBeDefined();
  // The form starts from the job, in hours and dollars.
  expect(valueOf("Status")).toBe("scheduled");
  expect(valueOf("Date")).toBe("2026-11-17");
  expect(valueOf("Start time")).toBe("09:00");
  expect(valueOf("Hours")).toBe("3");
  expect(valueOf("Service")).toBe("regular");
  expect(valueOf("Hourly rate")).toBe("45.00");
  expect(valueOf("Agreed price")).toBe("");
  expect(screen.getByText("Blank charges by the hour: $135.00.")).toBeDefined();
  // Dan left the business: he is not offered for a job he is not on.
  expect(
    screen
      .getAllByRole<HTMLInputElement>("checkbox")
      .map((input) => [input.labels?.[0]?.textContent, input.checked]),
  ).toEqual([
    ["Owner", true],
    ["Carla Invented", false],
  ]);
  expect(screen.getByText("1 person: 3 h at the house.")).toBeDefined();

  fill("Status", "completed");
  fill("Hours", "3.5");
  fireEvent.click(box("Carla Invented"));
  expect(screen.getByText("Blank charges by the hour: $157.50.")).toBeDefined();
  // The price is for the hours of cleaning; two people halve the visit.
  expect(screen.getByText("2 people: 1 h 45 min at the house.")).toBeDefined();
  save();

  // Back on the day of the job, which shows the change.
  expect(
    await screen.findByRole("heading", { name: "Tuesday, November 17, 2026" }),
  ).toBeDefined();
  expect(
    await screen.findByText("shared by 2 people, 1 h 45 min at the house"),
  ).toBeDefined();
  expect(requests.find((r) => r.method === "PATCH")?.body).toEqual({
    status: "completed",
    durationMinutes: 210,
    helpers: [{ helperId: carla.id, hourlyRateCents: null }],
  });
});

test("follows a job to the day it is moved to", async () => {
  const weekly: Job = {
    ...aliceVisit,
    recurringSeriesId: aliceBiweekly.id,
  };
  const moved: Job = {
    ...weekly,
    scheduledDate: "2026-11-18",
    startTime: "10:30:00",
  };
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /jobs": () => json(200, [moved]),
      [`GET /jobs/${weekly.id}`]: () => json(200, weekly),
      "GET /helpers": () => json(200, helpers),
      [`PATCH /jobs/${weekly.id}`]: () => json(200, moved),
    }),
  );
  renderApp({ route: `/jobs/${weekly.id}/edit` });

  // The series is one click away, for a change to every visit.
  const seriesLink = await screen.findByRole("link", {
    name: "recurring series",
  });
  expect(seriesLink.getAttribute("href")).toBe(
    `/recurring-series/${aliceBiweekly.id}/edit`,
  );
  expect(seriesLink.parentElement?.textContent).toBe(
    "Part of a recurring series: what changes here changes this visit only.",
  );
  fill("Date", "2026-11-18");
  fill("Start time", "10:30");
  save();

  expect(
    await screen.findByRole("heading", {
      name: "Wednesday, November 18, 2026",
    }),
  ).toBeDefined();
  expect(await screen.findByText("10:30 a.m. – 1:30 p.m.")).toBeDefined();
  expect(requests.find((r) => r.method === "PATCH")?.body).toEqual({
    scheduledDate: "2026-11-18",
    startTime: "10:30",
  });
});

test("clears an agreed price and sends money as cents", async () => {
  const hourly: Job = {
    ...bobVisit,
    serviceType: "deep",
    hourlyRateCents: 4750,
    fixedPriceCents: null,
    priceCents: 11875,
  };
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /jobs": () => json(200, [hourly]),
      [`GET /jobs/${bobVisit.id}`]: () => json(200, bobVisit),
      "GET /helpers": () => json(200, helpers),
      [`PATCH /jobs/${bobVisit.id}`]: () => json(200, hourly),
    }),
  );
  renderApp({ route: `/jobs/${bobVisit.id}/edit` });

  await screen.findByLabelText("Agreed price");
  expect(valueOf("Agreed price")).toBe("200.00");
  expect(valueOf("Notes about the job")).toBe("Bring the long ladder.");
  expect(
    screen.getByText("Invoice #12 keeps the price it was generated with."),
  ).toBeDefined();
  fill("Service", "deep");
  fill("Hourly rate", "47.5");
  fill("Agreed price", "");
  save();

  expect(await screen.findByText("Deep")).toBeDefined();
  expect(requests.find((r) => r.method === "PATCH")?.body).toEqual({
    serviceType: "deep",
    hourlyRateCents: 4750,
    fixedPriceCents: null,
  });
});

test("assigns a helper at a rate of the job's own", async () => {
  const special = doneBy(aliceVisit, [
    { helper: carla, hourlyRateCents: 2500 },
  ]);
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /jobs": () => json(200, [special]),
      [`GET /jobs/${aliceVisit.id}`]: () => json(200, aliceVisit),
      "GET /helpers": () => json(200, helpers),
      [`PATCH /jobs/${aliceVisit.id}`]: () => json(200, special),
    }),
  );
  renderApp({ route: `/jobs/${aliceVisit.id}/edit` });

  await screen.findByLabelText("Status");
  // What she is usually paid reads next to her name. A rate of the job is
  // asked for a helper who is on it.
  expect(screen.getByText("usually $22.50 an hour")).toBeDefined();
  expect(screen.queryByLabelText("Hourly rate of Carla Invented")).toBeNull();
  fireEvent.click(box("Carla Invented"));
  expect(valueOf("Hourly rate of Carla Invented")).toBe("");
  expect(
    screen.getByText(
      "A rate next to a helper is what the job pays them for an hour. Blank pays their usual rate.",
    ),
  ).toBeDefined();
  fill("Hourly rate of Carla Invented", "25");
  save();

  // The day shows the rate in effect on the job, for the 1h30 she is there.
  expect(
    await screen.findByText("at $25.00 an hour, $37.50 for the job"),
  ).toBeDefined();
  expect(requests.find((r) => r.method === "PATCH")?.body).toEqual({
    helpers: [{ helperId: carla.id, hourlyRateCents: 2500 }],
  });
});

test("returns a job to the usual rate of its helper", async () => {
  const special = doneBy(aliceVisit, [
    { helper: carla, hourlyRateCents: 2500 },
  ]);
  const usual = doneBy(aliceVisit, [carla]);
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /jobs": () => json(200, [usual]),
      [`GET /jobs/${special.id}`]: () => json(200, special),
      "GET /helpers": () => json(200, helpers),
      [`PATCH /jobs/${special.id}`]: () => json(200, usual),
    }),
  );
  renderApp({ route: `/jobs/${special.id}/edit` });

  await screen.findByLabelText("Hourly rate of Carla Invented");
  expect(valueOf("Hourly rate of Carla Invented")).toBe("25.00");
  // The rate is hers on this job: it goes when she is taken off it.
  fireEvent.click(box("Carla Invented"));
  expect(screen.queryByLabelText("Hourly rate of Carla Invented")).toBeNull();
  fireEvent.click(box("Carla Invented"));
  expect(valueOf("Hourly rate of Carla Invented")).toBe("");
  save();

  expect(
    await screen.findByText("at $22.50 an hour, $33.75 for the job"),
  ).toBeDefined();
  expect(requests.find((r) => r.method === "PATCH")?.body).toEqual({
    helpers: [{ helperId: carla.id, hourlyRateCents: null }],
  });
});

test("clears the rate a job has for a helper", async () => {
  const special = doneBy(aliceVisit, [
    { helper: carla, hourlyRateCents: 2500 },
  ]);
  const usual = doneBy(aliceVisit, [carla]);
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /jobs": () => json(200, [usual]),
      [`GET /jobs/${special.id}`]: () => json(200, special),
      "GET /helpers": () => json(200, helpers),
      [`PATCH /jobs/${special.id}`]: () => json(200, usual),
    }),
  );
  renderApp({ route: `/jobs/${special.id}/edit` });

  await screen.findByLabelText("Hourly rate of Carla Invented");
  fill("Hourly rate of Carla Invented", "");
  save();

  await screen.findByRole("heading", { name: "Tuesday, November 17, 2026" });
  expect(requests.find((r) => r.method === "PATCH")?.body).toEqual({
    helpers: [{ helperId: carla.id, hourlyRateCents: null }],
  });
});

test("takes the owner off a job the helper does alone", async () => {
  const together = doneBy(aliceVisit, [carla]);
  const alone = doneBy(aliceVisit, [carla], { ownerWorks: false });
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /jobs": () => json(200, [alone]),
      [`GET /jobs/${together.id}`]: () => json(200, together),
      "GET /helpers": () => json(200, helpers),
      [`PATCH /jobs/${together.id}`]: () => json(200, alone),
    }),
  );
  renderApp({ route: `/jobs/${together.id}/edit` });

  await screen.findByLabelText("Status");
  expect(box("Owner").checked).toBe(true);
  expect(box("Carla Invented").checked).toBe(true);
  expect(screen.getByText("2 people: 1 h 30 min at the house.")).toBeDefined();
  fireEvent.click(box("Owner"));
  expect(screen.getByText("1 person: 3 h at the house.")).toBeDefined();
  save();

  // Alone, she is there for all of the hours, and is paid for them.
  expect(
    await screen.findByText("at $22.50 an hour, $67.50 for the job"),
  ).toBeDefined();
  expect(screen.getByText("9:00 a.m. – 12:00 p.m.")).toBeDefined();
  // The helpers did not change: the list does not travel.
  expect(requests.find((r) => r.method === "PATCH")?.body).toEqual({
    ownerWorks: false,
  });
});

test("counts one person while nobody is marked", async () => {
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      [`GET /jobs/${aliceVisit.id}`]: () => json(200, aliceVisit),
      "GET /helpers": () => json(200, helpers),
    }),
  );
  renderApp({ route: `/jobs/${aliceVisit.id}/edit` });

  await screen.findByLabelText("Status");
  fireEvent.click(box("Owner"));
  expect(screen.getByText("1 person: 3 h at the house.")).toBeDefined();
  // Nothing to share the hours with until there are hours.
  fill("Hours", "");
  expect(
    screen.getByText("Hours of cleaning, shared by who does the job."),
  ).toBeDefined();
});

test("keeps an inactive helper on a job without sending them again", async () => {
  // Dan left the business; the job he did still has him.
  const dansJob = doneBy(bobVisit, [dan]);
  const noted: Job = { ...dansJob, notes: "Gate code 4321." };
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /jobs": () => json(200, [noted]),
      [`GET /jobs/${dansJob.id}`]: () => json(200, dansJob),
      "GET /helpers": () => json(200, helpers),
      [`PATCH /jobs/${dansJob.id}`]: () => json(200, noted),
    }),
  );
  renderApp({ route: `/jobs/${dansJob.id}/edit` });

  await screen.findByLabelText("Status");
  expect(box("Dan Former (inactive)").checked).toBe(true);
  // Dan has no usual rate: there is no amount to name next to him.
  expect(screen.getAllByText(/^usually /)).toHaveLength(1);
  fill("Notes about the job", " Gate code 4321. ");
  save();

  expect(await screen.findByText("Gate code 4321.")).toBeDefined();
  expect(requests.find((r) => r.method === "PATCH")?.body).toEqual({
    notes: "Gate code 4321.",
  });
});

test("sends the whole list when a helper joins one who became inactive", async () => {
  const dansJob = doneBy(bobVisit, [dan]);
  const both = doneBy(bobVisit, [carla, dan]);
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /jobs": () => json(200, [both]),
      [`GET /jobs/${dansJob.id}`]: () => json(200, dansJob),
      "GET /helpers": () => json(200, helpers),
      [`PATCH /jobs/${dansJob.id}`]: () => json(200, both),
    }),
  );
  renderApp({ route: `/jobs/${dansJob.id}/edit` });

  await screen.findByLabelText("Status");
  fireEvent.click(box("Carla Invented"));
  expect(screen.getByText("3 people: 50 min at the house.")).toBeDefined();
  save();

  await screen.findByRole("heading", { name: "Tuesday, November 17, 2026" });
  // The list replaces the one the job had, so Dan travels with it; the
  // API takes him because the job already had him.
  expect(requests.find((r) => r.method === "PATCH")?.body).toEqual({
    helpers: [
      { helperId: dan.id, hourlyRateCents: null },
      { helperId: carla.id, hourlyRateCents: null },
    ],
  });
});

test("returns to the day without asking the API when nothing changed", async () => {
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /jobs": () => json(200, [aliceVisit]),
      [`GET /jobs/${aliceVisit.id}`]: () => json(200, aliceVisit),
      "GET /helpers": () => json(200, helpers),
    }),
  );
  renderApp({ route: `/jobs/${aliceVisit.id}/edit` });

  await screen.findByLabelText("Status");
  save();

  expect(
    await screen.findByRole("heading", { name: "Tuesday, November 17, 2026" }),
  ).toBeDefined();
  expect(requests.some((r) => r.method === "PATCH")).toBe(false);
});

test("shows the API's issues under the job fields they name", async () => {
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      [`GET /jobs/${aliceVisit.id}`]: () => json(200, aliceVisit),
      "GET /helpers": () => json(200, helpers),
      [`PATCH /jobs/${aliceVisit.id}`]: () =>
        // The API names a helper by their place in the list it was sent.
        validationError([
          { path: "helpers.0.helperId", message: "Helper is not active" },
        ]),
    }),
  );
  renderApp({ route: `/jobs/${aliceVisit.id}/edit` });

  await screen.findByLabelText("Status");
  fireEvent.click(box("Carla Invented"));
  fill("Hours", "4");
  save();

  // Under the helper, and nowhere else: not below the fields as well.
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Helper is not active",
  );
  expect(box("Carla Invented").getAttribute("aria-invalid")).toBe("true");
  expect(box("Owner").getAttribute("aria-invalid")).toBeNull();
  expect(screen.getByLabelText("Hours").getAttribute("aria-invalid")).toBe(
    "false",
  );
  // What was typed stays, to be corrected and sent again.
  expect(valueOf("Hours")).toBe("4");
});

test("says when the job to edit does not exist", async () => {
  const id = "0199c4b0-7d2e-7a10-8c3e-3f1c9a2b4d99";
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      [`GET /jobs/${id}`]: () => apiError(404, "not_found", "Job not found"),
      "GET /helpers": () => json(200, helpers),
    }),
  );
  renderApp({ route: `/jobs/${id}/edit` });

  expect((await screen.findByRole("alert")).textContent).toBe("Job not found.");
  expect(screen.getByRole("link", { name: "Back to calendar" })).toBeDefined();
  expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
});

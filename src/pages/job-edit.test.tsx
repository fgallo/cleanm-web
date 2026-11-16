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
  aliceVisit,
  bobVisit,
  carla,
  dan,
  helpers,
  onJob,
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

function save() {
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
}

test("edits a job from its day and sends only what changed", async () => {
  const done: Job = {
    ...aliceVisit,
    status: "completed",
    durationMinutes: 210,
    priceCents: 15750,
    helper: onJob(carla),
  };
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
  expect(valueOf("Helper")).toBe("");
  expect(screen.getByText("Blank charges by the hour: $135.00.")).toBeDefined();
  // Dan left the business: he is not offered for a job he is not on.
  expect(
    Array.from(
      screen.getByLabelText<HTMLSelectElement>("Helper").options,
      (option) => option.textContent,
    ),
  ).toEqual(["No helper", "Carla Invented"]);

  fill("Status", "completed");
  fill("Hours", "3.5");
  fill("Helper", carla.id);
  expect(screen.getByText("Blank charges by the hour: $157.50.")).toBeDefined();
  save();

  // Back on the day of the job, which shows the change.
  expect(
    await screen.findByRole("heading", { name: "Tuesday, November 17, 2026" }),
  ).toBeDefined();
  expect(await screen.findByText("3.5 h")).toBeDefined();
  expect(requests.find((r) => r.method === "PATCH")?.body).toEqual({
    status: "completed",
    durationMinutes: 210,
    helperId: carla.id,
  });
});

test("follows a job to the day it is moved to", async () => {
  const weekly: Job = {
    ...aliceVisit,
    recurringSeriesId: "0199c4b0-7d2e-7a10-8c3e-3f1c9a2b4d60",
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

  expect(
    await screen.findByText(
      "Part of a recurring series: what changes here changes this visit only.",
    ),
  ).toBeDefined();
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
  const special: Job = {
    ...aliceVisit,
    helper: onJob(carla),
    helperHourlyRateCents: 2500,
  };
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

  await screen.findByLabelText("Helper's hourly rate");
  expect(valueOf("Helper's hourly rate")).toBe("");
  // Nobody chosen yet: there is no usual rate to name.
  expect(screen.getByText("Blank pays the helper's usual rate.")).toBeDefined();
  fill("Helper", carla.id);
  expect(
    screen.getByText("Blank pays the helper's usual rate: $22.50."),
  ).toBeDefined();
  fill("Helper's hourly rate", "25");
  save();

  // The day shows the rate in effect on the job.
  expect(await screen.findByText("at $25.00 an hour")).toBeDefined();
  expect(requests.find((r) => r.method === "PATCH")?.body).toEqual({
    helperId: carla.id,
    helperHourlyRateCents: 2500,
  });
});

test("returns a job to the usual rate of its helper", async () => {
  const special: Job = {
    ...aliceVisit,
    helper: onJob(carla),
    helperHourlyRateCents: 2500,
  };
  const usual: Job = { ...special, helperHourlyRateCents: null };
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

  await screen.findByLabelText("Helper's hourly rate");
  expect(valueOf("Helper's hourly rate")).toBe("25.00");
  // The rate belongs to the job: it stays as typed without a helper.
  fill("Helper", "");
  expect(valueOf("Helper's hourly rate")).toBe("25.00");
  fill("Helper", carla.id);
  fill("Helper's hourly rate", "");
  save();

  expect(await screen.findByText("at $22.50 an hour")).toBeDefined();
  expect(requests.find((r) => r.method === "PATCH")?.body).toEqual({
    helperHourlyRateCents: null,
  });
});

test("keeps an inactive helper on a job without sending them again", async () => {
  // The API refuses to assign Dan, even to the job he already has.
  const dansJob: Job = {
    ...bobVisit,
    helper: onJob(dan),
  };
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

  await screen.findByLabelText("Helper");
  expect(valueOf("Helper")).toBe(dan.id);
  expect(
    screen.getByRole("option", { name: "Dan Former (inactive)" }),
  ).toBeDefined();
  // Dan has no usual rate: there is no amount to name.
  expect(screen.getByText("Blank pays the helper's usual rate.")).toBeDefined();
  fill("Notes about the job", " Gate code 4321. ");
  save();

  expect(await screen.findByText("Gate code 4321.")).toBeDefined();
  expect(requests.find((r) => r.method === "PATCH")?.body).toEqual({
    notes: "Gate code 4321.",
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
        validationError([
          { path: "helperId", message: "Helper is not active" },
        ]),
    }),
  );
  renderApp({ route: `/jobs/${aliceVisit.id}/edit` });

  await screen.findByLabelText("Helper");
  fill("Helper", carla.id);
  fill("Hours", "4");
  save();

  expect((await screen.findByRole("alert")).textContent).toBe(
    "Helper is not active",
  );
  expect(screen.getByLabelText("Helper").getAttribute("aria-invalid")).toBe(
    "true",
  );
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

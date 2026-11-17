import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import type { Job } from "@/api/jobs.ts";
import {
  apiError,
  json,
  mockApi,
  routes,
  validationError,
} from "@/test/api.ts";
import {
  aliceInvoice,
  aliceVisit,
  bobInvoice,
  bobVisit,
  session,
} from "@/test/fixtures.ts";
import { renderApp } from "@/test/render.tsx";

// 02:00 UTC on the 18th is still the evening of the 17th in Toronto, where
// the organization is: an invoice generated now is issued on the 17th.
beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["Date"],
    now: new Date("2026-11-18T02:00:00Z"),
  });
});
afterEach(() => {
  vi.useRealTimers();
});

const newInvoicePath = `/jobs/${aliceVisit.id}/invoice/new`;

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function valueOf(label: string): string {
  return screen.getByLabelText<Control>(label).value;
}

function generate() {
  fireEvent.click(screen.getByRole("button", { name: "Generate invoice" }));
}

// Alice's visit alone, as the page of its invoice asks for it.
function aliceVisitRoutes() {
  return {
    "GET /auth/me": () => json(200, session),
    [`GET /jobs/${aliceVisit.id}`]: () => json(200, aliceVisit),
  };
}

test("generates the invoice of a job from its day, with a percentage off", async () => {
  const invoiced: Job = {
    ...aliceVisit,
    invoice: { id: aliceInvoice.id, number: aliceInvoice.number },
  };
  let generated = false;
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /jobs": () =>
        json(200, [generated ? invoiced : aliceVisit, bobVisit]),
      [`GET /jobs/${aliceVisit.id}`]: () =>
        json(200, generated ? invoiced : aliceVisit),
      "POST /invoices": () => {
        generated = true;
        return json(201, aliceInvoice);
      },
      [`GET /invoices/${aliceInvoice.id}`]: () => json(200, aliceInvoice),
    }),
  );
  renderApp({ route: "/calendar/2026-11-17" });

  fireEvent.click(
    await screen.findByRole("link", {
      name: "Generate invoice for Alice Example",
    }),
  );
  await screen.findByLabelText("Issue date");
  expect(screen.getByRole("heading", { name: "New invoice" })).toBeDefined();
  // What it will bill, from the job.
  expect(screen.getByText("Alice Example · 456 Sample Ave")).toBeDefined();
  expect(
    screen.getByText(
      "Tuesday, November 17, 2026 · $135.00 for 3 h at $45.00 an hour",
    ),
  ).toBeDefined();
  // It starts as the API would make it from the job alone.
  expect(valueOf("Issue date")).toBe("2026-11-17");
  expect(valueOf("Due date")).toBe("");
  // The item is the kind of cleaning the job is, picked and not typed.
  expect(valueOf("Item")).toBe("regular");
  expect(
    Array.from(
      screen.getByLabelText<HTMLSelectElement>("Item").options,
      (option) => option.textContent,
    ),
  ).toEqual([
    "Regular cleaning",
    "Deep cleaning",
    "Move-in cleaning",
    "Move-out cleaning",
    "Other…",
  ]);
  expect(screen.queryByLabelText("Other item")).toBeNull();
  // Nothing has to be written next to it.
  expect(valueOf("Description")).toBe("");
  expect(valueOf("Discount")).toBe("none");
  expect(screen.queryByLabelText("Discount description")).toBeNull();
  expect(valueOf("Notes")).toBe("");

  fill("Due date", "2026-12-01");
  fill("Description", "Oven included");
  fill("Discount", "percentage");
  fill("Percentage off", "10");
  fill("Discount description", "Referral");
  fill("Notes", "Thank you!");
  generate();

  // The invoice itself is where it leads.
  expect(
    await screen.findByRole("heading", { name: "Invoice #13" }),
  ).toBeDefined();
  expect(requests.find((r) => r.method === "POST")?.body).toEqual({
    jobId: aliceVisit.id,
    issueDate: "2026-11-17",
    dueDate: "2026-12-01",
    item: "Regular cleaning",
    description: "Oven included",
    fixedDiscountCents: null,
    discountBasisPoints: 1000,
    discountDescription: "Referral",
    notes: "Thank you!",
  });

  // And the day of the visit shows its number.
  fireEvent.click(
    screen.getByRole("link", { name: "Back to the day of the visit" }),
  );
  const card = (
    await screen.findByRole("heading", { name: "Alice Example" })
  ).closest("li") as HTMLElement;
  expect(
    (await within(card).findByRole("link", { name: "#13" })).getAttribute(
      "href",
    ),
  ).toBe(`/invoices/${aliceInvoice.id}`);
});

test("takes an amount off in cents, up to the price of the job", async () => {
  const requests = mockApi(
    routes({
      ...aliceVisitRoutes(),
      "POST /invoices": () => json(201, aliceInvoice),
      [`GET /invoices/${aliceInvoice.id}`]: () => json(200, aliceInvoice),
    }),
  );
  renderApp({ route: newInvoicePath });

  await screen.findByLabelText("Issue date");
  fill("Discount", "percentage");
  fill("Percentage off", "10");
  // Ten percent is not ten dollars: the number starts again.
  fill("Discount", "amount");
  expect(valueOf("Amount off")).toBe("");
  expect(screen.getByLabelText("Amount off").getAttribute("max")).toBe(
    "135.00",
  );
  expect(
    screen.getByText("In dollars, off the subtotal of $135.00, before tax."),
  ).toBeDefined();
  fill("Amount off", "19.99");
  generate();

  await screen.findByRole("heading", { name: "Invoice #13" });
  expect(requests.find((r) => r.method === "POST")?.body).toEqual({
    jobId: aliceVisit.id,
    issueDate: "2026-11-17",
    dueDate: null,
    item: "Regular cleaning",
    description: null,
    fixedDiscountCents: 1999,
    discountBasisPoints: null,
    discountDescription: null,
    notes: null,
  });
});

test("forgets a discount that was typed once none is chosen", async () => {
  const requests = mockApi(
    routes({
      ...aliceVisitRoutes(),
      "POST /invoices": () => json(201, aliceInvoice),
      [`GET /invoices/${aliceInvoice.id}`]: () => json(200, aliceInvoice),
    }),
  );
  renderApp({ route: newInvoicePath });

  await screen.findByLabelText("Issue date");
  fill("Issue date", "2026-11-20");
  fill("Item", "deep");
  fill("Discount", "amount");
  fill("Amount off", "20");
  fill("Discount description", "Referral");
  fill("Discount", "none");
  generate();

  await screen.findByRole("heading", { name: "Invoice #13" });
  expect(requests.find((r) => r.method === "POST")?.body).toEqual({
    jobId: aliceVisit.id,
    issueDate: "2026-11-20",
    dueDate: null,
    item: "Deep cleaning",
    description: null,
    fixedDiscountCents: null,
    discountBasisPoints: null,
    discountDescription: null,
    notes: null,
  });
});

test("writes out an item that is none of the usual ones", async () => {
  const requests = mockApi(
    routes({
      ...aliceVisitRoutes(),
      "POST /invoices": () => json(201, aliceInvoice),
      [`GET /invoices/${aliceInvoice.id}`]: () => json(200, aliceInvoice),
    }),
  );
  renderApp({ route: newInvoicePath });

  await screen.findByLabelText("Issue date");
  fill("Item", "other");
  generate();

  // Nothing to print yet: the browser refuses the form, and a request
  // would leave a tick later.
  expect(
    screen.getByLabelText<HTMLInputElement>("Other item").validity.valueMissing,
  ).toBe(true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(requests.some((r) => r.method === "POST")).toBe(false);

  fill("Other item", "Oven and fridge");
  generate();

  await screen.findByRole("heading", { name: "Invoice #13" });
  expect(requests.find((r) => r.method === "POST")?.body).toMatchObject({
    item: "Oven and fridge",
    description: null,
  });
});

test("asks how much the discount is before anything is sent", async () => {
  const requests = mockApi(routes(aliceVisitRoutes()));
  renderApp({ route: newInvoicePath });

  await screen.findByLabelText("Issue date");
  fill("Discount", "percentage");
  generate();

  // The browser refuses the form; a request would leave a tick later.
  expect(
    screen.getByLabelText<HTMLInputElement>("Percentage off").validity
      .valueMissing,
  ).toBe(true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(requests.some((r) => r.method === "POST")).toBe(false);
});

test("shows what the API refuses under its field, and the rest below", async () => {
  let attempts = 0;
  mockApi(
    routes({
      ...aliceVisitRoutes(),
      "POST /invoices": () => {
        attempts += 1;
        return attempts === 1
          ? validationError([
              { path: "item", message: "Too long" },
              { path: "dueDate", message: "Must not be before issueDate" },
              {
                path: "fixedDiscountCents",
                message: "Must not exceed the subtotal",
              },
            ])
          : apiError(
              409,
              "conflict",
              "Cannot invoice: the job is already invoiced",
            );
      },
    }),
  );
  renderApp({ route: newInvoicePath });

  await screen.findByLabelText("Issue date");
  fill("Due date", "2026-11-20");
  fill("Discount", "amount");
  fill("Amount off", "20");
  generate();

  expect(await screen.findByText("Must not be before issueDate")).toBeDefined();
  expect(screen.getByText("Must not exceed the subtotal")).toBeDefined();
  expect(screen.getByText("Too long")).toBeDefined();
  expect(screen.getAllByRole("alert")).toHaveLength(3);
  expect(screen.getByLabelText("Item").getAttribute("aria-invalid")).toBe(
    "true",
  );
  expect(screen.getByLabelText("Due date").getAttribute("aria-invalid")).toBe(
    "true",
  );
  expect(screen.getByLabelText("Amount off").getAttribute("aria-invalid")).toBe(
    "true",
  );
  // What was typed stays.
  expect(valueOf("Amount off")).toBe("20");

  generate();

  // Someone else generated it meanwhile: not about a field.
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Cannot invoice: the job is already invoiced",
  );
  expect(screen.getByLabelText("Due date").getAttribute("aria-invalid")).toBe(
    "false",
  );
});

test("leads to the invoice a job already has instead of another one", async () => {
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      [`GET /jobs/${bobVisit.id}`]: () => json(200, bobVisit),
    }),
  );
  renderApp({ route: `/jobs/${bobVisit.id}/invoice/new` });

  expect(
    await screen.findByText(/This job already has an invoice/),
  ).toBeDefined();
  expect(screen.getByRole("link", { name: "#12" }).getAttribute("href")).toBe(
    `/invoices/${bobInvoice.id}`,
  );
  expect(screen.queryByRole("button", { name: "Generate invoice" })).toBeNull();
});

test("says why a job that is not a visit gets no invoice", async () => {
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      [`GET /jobs/${aliceVisit.id}`]: () =>
        json(200, { ...aliceVisit, status: "cancelled" }),
    }),
  );
  renderApp({ route: newInvoicePath });

  expect((await screen.findByRole("alert")).textContent).toBe(
    "A job that is cancelled cannot be invoiced, only one that is scheduled or completed.",
  );
  expect(
    screen
      .getByRole("link", { name: "Back to the day of the job" })
      .getAttribute("href"),
  ).toBe("/calendar/2026-11-17");
  expect(screen.queryByRole("button", { name: "Generate invoice" })).toBeNull();
});

test("says when the job does not exist", async () => {
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      [`GET /jobs/${aliceVisit.id}`]: () =>
        apiError(404, "not_found", "Job not found"),
    }),
  );
  renderApp({ route: newInvoicePath });

  expect((await screen.findByRole("alert")).textContent).toBe("Job not found.");
  expect(screen.getByRole("link", { name: "Back to calendar" })).toBeDefined();
});

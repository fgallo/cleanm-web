import { fireEvent, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import type { Invoice } from "@/api/invoices.ts";
import {
  apiError,
  json,
  mockApi,
  routes,
  validationError,
} from "@/test/api.ts";
import { aliceInvoice, bobInvoice, session } from "@/test/fixtures.ts";
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

// What the totals of the invoice page say next to this label.
function amountOf(label: string): string | null | undefined {
  return screen.getByText(label, { selector: "dt" }).nextElementSibling
    ?.textContent;
}

const bobPath = `/invoices/${bobInvoice.id}`;
const alicePath = `/invoices/${aliceInvoice.id}`;

// One invoice, as its page and its form ask for it.
function invoiceRoutes(invoice: Invoice) {
  return {
    "GET /auth/me": () => json(200, session),
    [`GET /invoices/${invoice.id}`]: () => json(200, invoice),
  };
}

test("edits an invoice and sends only what changed", async () => {
  // What the API makes of it: the amounts follow the price.
  const cheaper: Invoice = {
    ...bobInvoice,
    dueDate: "2026-12-01",
    description: "Oven included",
    fixedPriceCents: 18000,
    subtotalCents: 18000,
    taxCents: 2340,
    totalCents: 20340,
    amountDueCents: 9040,
  };
  let saved = false;
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      [`GET ${bobPath}`]: () => json(200, saved ? cheaper : bobInvoice),
      [`PATCH ${bobPath}`]: () => {
        saved = true;
        return json(200, cheaper);
      },
    }),
  );
  // Where "Edit" on the page of the invoice leads.
  renderApp({ route: `${bobPath}/edit` });

  await screen.findByLabelText("Issue date");
  expect(screen.getByRole("heading", { name: "Edit invoice" })).toBeDefined();
  // Which invoice, and who it bills, as the invoice holds them.
  expect(screen.getByText("#12 · Bob Sample · 78 Invented St")).toBeDefined();
  // The form starts from the invoice, in hours and dollars.
  expect(valueOf("Issue date")).toBe("2026-11-17");
  expect(valueOf("Due date")).toBe("");
  // An item that reads as a kind of cleaning is picked again, not typed.
  expect(valueOf("Item")).toBe("move_out");
  expect(screen.queryByLabelText("Other item")).toBeNull();
  expect(valueOf("Description")).toBe("");
  expect(valueOf("Service date")).toBe("2026-11-17");
  expect(valueOf("Hours")).toBe("2.5");
  expect(valueOf("Hourly rate")).toBe("50.00");
  expect(valueOf("Agreed price")).toBe("200.00");
  expect(valueOf("Discount")).toBe("none");
  expect(valueOf("Notes")).toBe("Thank you for your business.");

  fill("Due date", "2026-12-01");
  fill("Description", "Oven included");
  fill("Agreed price", "180");
  save();

  // Back on the invoice, which shows the answer.
  expect(
    await screen.findByRole("heading", { name: "Invoice #12" }),
  ).toBeDefined();
  expect(
    screen.getByText(
      "Issued Nov 17, 2026 · Service on Nov 17, 2026 · Due Dec 1, 2026",
    ),
  ).toBeDefined();
  expect(screen.getByText("Oven included")).toBeDefined();
  expect(amountOf("Total")).toBe("$203.40");
  expect(requests.find((r) => r.method === "PATCH")?.body).toStrictEqual({
    dueDate: "2026-12-01",
    description: "Oven included",
    fixedPriceCents: 18000,
  });
});

test("takes the discount off what the hours and the rate come to", async () => {
  // Generated for something that is no kind of cleaning, with 10% off.
  const custom: Invoice = { ...aliceInvoice, item: "Oven and fridge" };
  const requests = mockApi(
    routes({
      ...invoiceRoutes(custom),
      [`PATCH ${alicePath}`]: () => json(200, custom),
    }),
  );
  renderApp({ route: `${alicePath}/edit` });

  await screen.findByLabelText("Issue date");
  // An item of its own is written out.
  expect(valueOf("Item")).toBe("other");
  expect(valueOf("Other item")).toBe("Oven and fridge");
  expect(valueOf("Hours")).toBe("3");
  expect(valueOf("Hourly rate")).toBe("45.00");
  expect(valueOf("Agreed price")).toBe("");
  expect(valueOf("Discount")).toBe("percentage");
  expect(valueOf("Percentage off")).toBe("10");
  expect(valueOf("Discount description")).toBe("Referral");
  expect(
    screen.getByText("Of the subtotal of $135.00, before tax."),
  ).toBeDefined();

  // An hour more is charged, and the discount counts on the new price.
  fill("Hours", "4");
  expect(screen.getByText("Blank charges by the hour: $180.00.")).toBeDefined();
  expect(
    screen.getByText("Of the subtotal of $180.00, before tax."),
  ).toBeDefined();
  fill("Discount", "amount");
  expect(valueOf("Amount off")).toBe("");
  expect(screen.getByLabelText("Amount off").getAttribute("max")).toBe(
    "180.00",
  );
  // An agreed price comes before the hours.
  fill("Agreed price", "150");
  expect(screen.getByLabelText("Amount off").getAttribute("max")).toBe(
    "150.00",
  );
  fill("Agreed price", "");
  // Nothing to count on while the hours are not known.
  fill("Hours", "");
  expect(
    screen.getByText("In dollars, off the subtotal, before tax."),
  ).toBeDefined();
  expect(screen.getByLabelText("Amount off").getAttribute("max")).toBeNull();
  fill("Hours", "4");
  fill("Amount off", "20");
  fill("Item", "deep");
  save();

  await screen.findByRole("heading", { name: "Invoice #13" });
  // One form of discount replaces the other.
  expect(requests.find((r) => r.method === "PATCH")?.body).toStrictEqual({
    item: "Deep cleaning",
    durationMinutes: 240,
    fixedDiscountCents: 2000,
    discountBasisPoints: null,
  });
});

test("clears what is left blank and removes a discount with its description", async () => {
  const requests = mockApi(
    routes({
      ...invoiceRoutes(aliceInvoice),
      [`PATCH ${alicePath}`]: () => json(200, aliceInvoice),
    }),
  );
  renderApp({ route: `${alicePath}/edit` });

  await screen.findByLabelText("Issue date");
  expect(valueOf("Due date")).toBe("2026-12-01");
  // Back to due on receipt, with the button next to the field.
  fireEvent.click(screen.getByRole("button", { name: "Clear due date" }));
  expect(valueOf("Due date")).toBe("");
  fill("Service date", "2026-11-16");
  fill("Discount", "none");
  fill("Notes", "");
  save();

  await screen.findByRole("heading", { name: "Invoice #13" });
  expect(requests.find((r) => r.method === "PATCH")?.body).toStrictEqual({
    dueDate: null,
    serviceDate: "2026-11-16",
    discountBasisPoints: null,
    discountDescription: null,
    notes: null,
  });
});

test("returns to the invoice without asking the API when nothing changed", async () => {
  // Every field gives back what it was filled from: a duration that is no
  // round number of hours, half a percent, an item and a description of
  // its own.
  const odd: Invoice = {
    ...aliceInvoice,
    item: "Oven and fridge",
    description: "Inside and out",
    durationMinutes: 100,
    discountBasisPoints: 1250,
    notes: "Thank you!\nSee you in two weeks.",
  };
  const requests = mockApi(routes(invoiceRoutes(odd)));
  renderApp({ route: `${alicePath}/edit` });

  await screen.findByLabelText("Issue date");
  expect(valueOf("Hours")).toBe("1.67");
  expect(valueOf("Percentage off")).toBe("12.5");
  save();

  expect(
    await screen.findByRole("heading", { name: "Invoice #13" }),
  ).toBeDefined();
  expect(requests.some((r) => r.method === "PATCH")).toBe(false);
});

test("shows what the API refuses under its field, and the rest below", async () => {
  let attempts = 0;
  mockApi(
    routes({
      ...invoiceRoutes(bobInvoice),
      [`PATCH ${bobPath}`]: () => {
        attempts += 1;
        return attempts === 1
          ? validationError([
              { path: "durationMinutes", message: "Too big" },
              { path: "dueDate", message: "Must not be before issueDate" },
              {
                path: "fixedDiscountCents",
                message: "Must not exceed the subtotal",
              },
            ])
          : apiError(409, "conflict", "Cannot edit: the invoice is paid");
      },
    }),
  );
  renderApp({ route: `${bobPath}/edit` });

  await screen.findByLabelText("Issue date");
  fill("Hours", "3");
  fill("Due date", "2026-11-20");
  fill("Discount", "amount");
  fill("Amount off", "20");
  save();

  expect(await screen.findByText("Too big")).toBeDefined();
  expect(screen.getByText("Must not be before issueDate")).toBeDefined();
  expect(screen.getByText("Must not exceed the subtotal")).toBeDefined();
  // Each under its field, none repeated below.
  expect(screen.getAllByRole("alert")).toHaveLength(3);
  expect(screen.getByLabelText("Hours").getAttribute("aria-invalid")).toBe(
    "true",
  );
  expect(screen.getByLabelText("Due date").getAttribute("aria-invalid")).toBe(
    "true",
  );
  expect(screen.getByLabelText("Amount off").getAttribute("aria-invalid")).toBe(
    "true",
  );
  // What was typed stays.
  expect(valueOf("Hours")).toBe("3");

  save();

  // Paid in full meanwhile: not about a field.
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Cannot edit: the invoice is paid",
  );
  expect(screen.getByLabelText("Hours").getAttribute("aria-invalid")).toBe(
    "false",
  );
});

test("offers no form for an invoice paid in full", async () => {
  const paid: Invoice = {
    ...bobInvoice,
    paidCents: 22600,
    amountDueCents: 0,
    paid: true,
    locked: true,
  };
  mockApi(routes(invoiceRoutes(paid)));
  renderApp({ route: `${bobPath}/edit` });

  expect((await screen.findByRole("alert")).textContent).toBe(
    "Invoice #12 is paid in full, so it is closed: it can no longer be edited.",
  );
  expect(
    screen
      .getByRole("link", { name: "Back to the invoice" })
      .getAttribute("href"),
  ).toBe(bobPath);
  expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
});

test("says when the invoice to edit does not exist", async () => {
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      [`GET ${bobPath}`]: () => apiError(404, "not_found", "Invoice not found"),
    }),
  );
  renderApp({ route: `${bobPath}/edit` });

  expect((await screen.findByRole("alert")).textContent).toBe(
    "Invoice not found.",
  );
  expect(screen.getByRole("link", { name: "Back to calendar" })).toBeDefined();
  expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
});

import { fireEvent, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";

import type { Invoice } from "@/api/invoices.ts";
import type { Job } from "@/api/jobs.ts";
import {
  apiError,
  json,
  mockApi,
  networkFailure,
  noContent,
  routes,
} from "@/test/api.ts";
import {
  aliceInvoice,
  aliceVisit,
  bob,
  bobInvoice,
  bobVisit,
  session,
} from "@/test/fixtures.ts";
import { renderApp } from "@/test/render.tsx";

const invoicePath = `/invoices/${bobInvoice.id}`;

// What the totals say next to this label.
function amountOf(label: string): string | null | undefined {
  return screen.getByText(label, { selector: "dt" }).nextElementSibling
    ?.textContent;
}

// The cells of the row that holds this text.
function rowOf(text: string): (string | null)[] {
  const row = screen.getByText(text).closest("tr");
  if (row === null) {
    throw new Error(`No row for ${text}`);
  }
  return Array.from(row.cells, (cell) => cell.textContent);
}

function click(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

test("shows an invoice from the day of its visit, as its PDF prints it", async () => {
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /jobs": () => json(200, [aliceVisit, bobVisit]),
      [`GET ${invoicePath}`]: () => json(200, bobInvoice),
    }),
  );
  renderApp({ route: "/calendar/2026-11-17" });

  fireEvent.click(await screen.findByRole("link", { name: "#12" }));

  expect(
    await screen.findByRole("heading", { name: "Invoice #12" }),
  ).toBeDefined();
  // Half of it came in.
  expect(screen.getByText("Partly paid")).toBeDefined();
  expect(
    screen.getByText(
      "Issued Nov 17, 2026 · Service on Nov 17, 2026 · Due on receipt",
    ),
  ).toBeDefined();

  // Who it bills, as the invoice holds it.
  const billTo = within(
    screen.getByRole("heading", { name: "Bill to" })
      .parentElement as HTMLElement,
  );
  expect(
    billTo.getByRole("link", { name: "Bob Sample" }).getAttribute("href"),
  ).toBe(`/clients/${bob.id}`);
  expect(billTo.getByText("78 Invented St")).toBeDefined();
  expect(billTo.getByText("Toronto, ON M5V 2T6")).toBeDefined();

  // The line is the item and what may be written next to it, here nothing.
  expect(rowOf("Items")).toEqual([
    "Items",
    "Description",
    "Quantity",
    "Price",
    "Amount",
  ]);
  // An agreed price is one visit at that price.
  expect(rowOf("Move-out cleaning")).toEqual([
    "Move-out cleaning",
    "—",
    "1",
    "$200.00",
    "$200.00",
  ]);
  expect(amountOf("Subtotal")).toBe("$200.00");
  expect(amountOf("HST (13%)")).toBe("$26.00");
  expect(amountOf("Total")).toBe("$226.00");
  expect(amountOf("Paid")).toBe("-$113.00");
  expect(amountOf("Amount due")).toBe("$113.00");
  // No discount, no line for one.
  expect(screen.queryByText(/Discount/)).toBeNull();

  expect(rowOf("E-transfer")).toEqual([
    "Nov 18, 2026",
    "E-transfer",
    "First half.",
    "$113.00",
  ]);
  expect(screen.getByText("Thank you for your business.")).toBeDefined();

  // The PDF is the API's, opened by the browser in another tab.
  const pdf = screen.getByRole("link", { name: "Open PDF" });
  expect(pdf.getAttribute("href")).toBe(
    `http://api.test/invoices/${bobInvoice.id}/pdf`,
  );
  expect(pdf.getAttribute("target")).toBe("_blank");
  expect(
    screen
      .getByRole("link", { name: "Back to the day of the visit" })
      .getAttribute("href"),
  ).toBe("/calendar/2026-11-17");

  // Not paid in full, so it can still be edited. What was paid keeps it
  // from being deleted.
  expect(screen.getByRole("link", { name: "Edit" }).getAttribute("href")).toBe(
    `/invoices/${bobInvoice.id}/edit`,
  );
  expect(screen.getByRole("button", { name: "Refresh details" })).toBeDefined();
  expect(
    screen.getByText(
      "It has payments, and an invoice with payments cannot be deleted.",
    ),
  ).toBeDefined();
  expect(screen.queryByRole("button", { name: "Delete invoice" })).toBeNull();
});

test("shows an invoice by the hour with a percentage off, paid in full", async () => {
  const hourly: Invoice = {
    ...bobInvoice,
    dueDate: "2026-12-01",
    item: "Deep cleaning",
    description: "Oven included",
    // Invoiced three days after the visit.
    serviceDate: "2026-11-14",
    fixedPriceCents: null,
    subtotalCents: 12500,
    discountBasisPoints: 1000,
    discountDescription: "Referral",
    discountCents: 1250,
    // A business that charges no tax.
    taxName: null,
    taxRateBasisPoints: 0,
    taxRegistrationNumber: null,
    taxCents: 0,
    totalCents: 11250,
    paidCents: 11250,
    amountDueCents: 0,
    paid: true,
    locked: true,
    payments: [
      {
        id: "0199c4b0-7d2e-7a10-8c3e-3f1c9a2b4d71",
        paidOn: "2026-11-20",
        method: "cash",
        amountCents: 11250,
        notes: null,
      },
    ],
    notes: null,
  };
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      [`GET ${invoicePath}`]: () => json(200, hourly),
    }),
  );
  renderApp({ route: invoicePath });

  await screen.findByRole("heading", { name: "Invoice #12" });
  expect(screen.getByText("Paid", { selector: "span" })).toBeDefined();
  expect(
    screen.getByText(
      "Issued Nov 17, 2026 · Service on Nov 14, 2026 · Due Dec 1, 2026",
    ),
  ).toBeDefined();
  expect(rowOf("Deep cleaning")).toEqual([
    "Deep cleaning",
    "Oven included",
    "2.5 h",
    "$50.00",
    "$125.00",
  ]);
  expect(amountOf("Subtotal")).toBe("$125.00");
  expect(amountOf("Referral (10%)")).toBe("-$12.50");
  expect(amountOf("Total")).toBe("$112.50");
  expect(amountOf("Paid")).toBe("-$112.50");
  expect(amountOf("Amount due")).toBe("$0.00");
  // No tax, no line for it.
  expect(screen.queryByText(/Tax|HST/)).toBeNull();
  expect(rowOf("Cash")).toEqual(["Nov 20, 2026", "Cash", "—", "$112.50"]);
  expect(screen.queryByRole("heading", { name: "Notes" })).toBeNull();

  // Closed: nothing that changes it is offered, and the page says why.
  expect(
    screen.getByText(
      "Paid in full, so it is closed: it can no longer be edited or deleted while its payments cover the total.",
    ),
  ).toBeDefined();
  expect(screen.queryByRole("link", { name: "Edit" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Refresh details" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "Delete invoice" })).toBeNull();
  // The PDF is still there to open.
  expect(screen.getByRole("link", { name: "Open PDF" })).toBeDefined();
});

test("shows an invoice nobody paid yet, with an amount off", async () => {
  const unpaid: Invoice = {
    ...bobInvoice,
    fixedDiscountCents: 2000,
    discountCents: 2000,
    taxCents: 2340,
    totalCents: 20340,
    paidCents: 0,
    amountDueCents: 20340,
    payments: [],
  };
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      [`GET ${invoicePath}`]: () => json(200, unpaid),
    }),
  );
  renderApp({ route: invoicePath });

  await screen.findByRole("heading", { name: "Invoice #12" });
  expect(screen.getByText("Unpaid")).toBeDefined();
  // A discount nobody described is just a discount.
  expect(amountOf("Discount")).toBe("-$20.00");
  expect(amountOf("HST (13%)")).toBe("$23.40");
  expect(amountOf("Total")).toBe("$203.40");
  expect(amountOf("Amount due")).toBe("$203.40");
  expect(screen.queryByText("Paid", { selector: "dt" })).toBeNull();
  expect(screen.getByText("No payments yet.")).toBeDefined();
});

test("says when the invoice does not exist", async () => {
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      [`GET ${invoicePath}`]: () =>
        apiError(404, "not_found", "Invoice not found"),
    }),
  );
  renderApp({ route: invoicePath });

  expect((await screen.findByRole("alert")).textContent).toBe(
    "Invoice not found.",
  );
  expect(screen.getByRole("link", { name: "Back to calendar" })).toBeDefined();
});

test("offers to try again when the invoice fails to load", async () => {
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      [`GET ${invoicePath}`]: () => networkFailure(),
    }),
  );
  renderApp({ route: invoicePath });

  expect((await screen.findByRole("alert")).textContent).toContain(
    "Could not reach the API",
  );
  expect(screen.getByRole("button", { name: "Try again" })).toBeDefined();
});

test("copies the current details into an invoice again, after asking twice", async () => {
  // Issued with the client's name misspelled, corrected on the client since.
  const misspelled: Invoice = {
    ...bobInvoice,
    billTo: { ...bobInvoice.billTo, name: "Bob Sampel" },
  };
  const refreshPath = `${invoicePath}/refresh`;
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      [`GET ${invoicePath}`]: () => json(200, misspelled),
      [`POST ${refreshPath}`]: () => json(200, bobInvoice),
    }),
  );
  renderApp({ route: invoicePath });

  expect(await screen.findByRole("link", { name: "Bob Sampel" })).toBeDefined();
  click("Refresh details");
  expect(
    screen.getByText(
      "Replace what the invoice prints with the current details?",
    ),
  ).toBeDefined();
  // Changing her mind costs nothing.
  click("Keep them");
  expect(screen.queryByText(/Replace what the invoice prints/)).toBeNull();
  expect(requests.some((r) => r.method === "POST")).toBe(false);

  click("Refresh details");
  click("Yes, refresh");

  expect((await screen.findByRole("status")).textContent).toBe(
    "The invoice now prints the current details.",
  );
  // The page shows the answer, without asking for the invoice again.
  expect(screen.getByRole("link", { name: "Bob Sample" })).toBeDefined();
  expect(screen.queryByText("Bob Sampel")).toBeNull();
  expect(screen.getByRole("button", { name: "Refresh details" })).toBeDefined();
  const sent = requests.filter((r) => r.method === "POST");
  expect(sent.map((r) => r.path)).toEqual([refreshPath]);
  expect(sent[0]?.body).toBeUndefined();
  expect(requests.filter((r) => r.method === "GET")).toHaveLength(2);
});

test("deletes an invoice nobody paid, after asking twice, and frees its visit", async () => {
  const invoiced: Job = {
    ...aliceVisit,
    invoice: { id: aliceInvoice.id, number: aliceInvoice.number },
  };
  const alicePath = `/invoices/${aliceInvoice.id}`;
  let deleted = false;
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /jobs": () => json(200, [deleted ? aliceVisit : invoiced, bobVisit]),
      [`GET ${alicePath}`]: () => json(200, aliceInvoice),
      [`DELETE ${alicePath}`]: () => {
        deleted = true;
        return noContent();
      },
    }),
  );
  renderApp({ route: "/calendar/2026-11-17" });

  fireEvent.click(await screen.findByRole("link", { name: "#13" }));
  await screen.findByRole("heading", { name: "Invoice #13" });
  expect(
    screen.getByText(
      "Removes the invoice, and the visit can be invoiced again. Its number, #13, is not given to another invoice.",
    ),
  ).toBeDefined();
  click("Delete invoice");
  expect(screen.getByText("Delete invoice #13?")).toBeDefined();
  click("Keep it");
  expect(screen.queryByText("Delete invoice #13?")).toBeNull();
  expect(requests.some((r) => r.method === "DELETE")).toBe(false);

  click("Delete invoice");
  click("Yes, delete");

  // Back on the day of the visit, which can be invoiced again.
  const card = (
    await screen.findByRole("heading", { name: "Alice Example" })
  ).closest("li") as HTMLElement;
  expect(
    await within(card).findByRole("link", {
      name: "Generate invoice for Alice Example",
    }),
  ).toBeDefined();
  expect(within(card).queryByRole("link", { name: "#13" })).toBeNull();
  expect(requests.filter((r) => r.method === "DELETE")).toHaveLength(1);
});

test("says why the API refused, and keeps the invoice", async () => {
  const alicePath = `/invoices/${aliceInvoice.id}`;
  // Someone recorded a payment in full since the page was loaded.
  const paidMeanwhile = "Cannot delete: still referenced by payments";
  const closedMeanwhile = "Cannot edit: the invoice is paid";
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      [`GET ${alicePath}`]: () => json(200, aliceInvoice),
      [`DELETE ${alicePath}`]: () => apiError(409, "conflict", paidMeanwhile),
      [`POST ${alicePath}/refresh`]: () =>
        apiError(409, "conflict", closedMeanwhile),
    }),
  );
  renderApp({ route: alicePath });

  await screen.findByRole("heading", { name: "Invoice #13" });
  click("Delete invoice");
  click("Yes, delete");

  expect((await screen.findByRole("alert")).textContent).toBe(paidMeanwhile);
  // Still on the invoice; what was refused goes with the question.
  expect(screen.getByRole("heading", { name: "Invoice #13" })).toBeDefined();
  click("Keep it");
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByRole("button", { name: "Delete invoice" })).toBeDefined();

  click("Refresh details");
  click("Yes, refresh");

  expect((await screen.findByRole("alert")).textContent).toBe(closedMeanwhile);
  expect(screen.queryByRole("status")).toBeNull();
  click("Keep them");
  expect(screen.queryByRole("alert")).toBeNull();
});

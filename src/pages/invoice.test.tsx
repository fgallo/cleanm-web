import { fireEvent, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";

import type { Invoice } from "@/api/invoices.ts";
import { apiError, json, mockApi, networkFailure, routes } from "@/test/api.ts";
import {
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
    screen.getByText("Issued Nov 17, 2026 · Due on receipt"),
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

  // An agreed price is one visit at that price.
  expect(rowOf("Move-out cleaning")).toEqual([
    "Move-out cleaning",
    "Nov 17, 2026",
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
});

test("shows an invoice by the hour with a percentage off, paid in full", async () => {
  const hourly: Invoice = {
    ...bobInvoice,
    dueDate: "2026-12-01",
    description: "Deep cleaning",
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
    screen.getByText("Issued Nov 17, 2026 · Due Dec 1, 2026"),
  ).toBeDefined();
  expect(rowOf("Deep cleaning")).toEqual([
    "Deep cleaning",
    "Nov 17, 2026",
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

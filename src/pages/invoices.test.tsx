import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import type { Invoice } from "@/api/invoices.ts";
import {
  json,
  mockApi,
  networkFailure,
  routes,
  type ApiRequest,
} from "@/test/api.ts";
import { alice, aliceInvoice, bobInvoice, session } from "@/test/fixtures.ts";
import { renderApp } from "@/test/render.tsx";

afterEach(() => {
  vi.useRealTimers();
});

// Noon in Toronto on November 17, 2026.
function inNovember() {
  vi.useFakeTimers({
    toFake: ["Date"],
    now: new Date("2026-11-17T17:00:00Z"),
  });
}

// The row of the table whose invoice has this number, or the one below
// them that says how many there are.
function rowOf(text: string): HTMLElement {
  const row = screen.getByText(text).closest("tr");
  if (row === null) {
    throw new Error(`No row for ${text}`);
  }
  return row;
}

// The days the last list was asked for.
function lastRange(requests: ApiRequest[]): string | undefined {
  return requests.findLast((r) => r.path === "/invoices")?.url;
}

const november = "http://api.test/invoices?from=2026-11-01&to=2026-11-30";

test("lists the invoices issued this month, from the menu", async () => {
  inNovember();
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      // The latest first, as the API orders them.
      "GET /invoices": () => json(200, [aliceInvoice, bobInvoice]),
      [`GET /invoices/${bobInvoice.id}`]: () => json(200, bobInvoice),
    }),
  );
  renderApp({ route: "/" });

  const link = await screen.findByRole("link", { name: "Invoices" });
  fireEvent.click(link);

  expect(
    await screen.findByRole("heading", { name: "Invoices" }),
  ).toBeDefined();
  expect(link.getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("heading", { name: "November 2026" })).toBeDefined();
  // Nowhere to return to while this month is the one listed.
  expect(screen.queryByRole("link", { name: "This month" })).toBeNull();

  await screen.findByText("Alice Example");
  // The whole month, from its first day to its last.
  expect(lastRange(requests)).toBe(november);
  expect(
    screen
      .getAllByRole("link", { name: /^#\d+$/ })
      .map((invoice) => invoice.textContent),
  ).toEqual(["#13", "#12"]);

  const unpaid = within(rowOf("#13"));
  expect(unpaid.getByRole("link", { name: "#13" }).getAttribute("href")).toBe(
    `/invoices/${aliceInvoice.id}`,
  );
  expect(unpaid.getByText("Nov 17, 2026")).toBeDefined();
  expect(
    unpaid.getByRole("link", { name: "Alice Example" }).getAttribute("href"),
  ).toBe(`/clients/${alice.id}`);
  expect(unpaid.getByText("456 Sample Ave")).toBeDefined();
  expect(unpaid.getByText("Regular cleaning")).toBeDefined();
  // All of the total is still due.
  expect(unpaid.getAllByText("$137.30")).toHaveLength(2);
  expect(unpaid.getByText("Unpaid")).toBeDefined();

  const halfPaid = within(rowOf("#12"));
  expect(halfPaid.getByText("Bob Sample")).toBeDefined();
  expect(halfPaid.getByText("78 Invented St")).toBeDefined();
  expect(halfPaid.getByText("Move-out cleaning")).toBeDefined();
  expect(halfPaid.getByText("$226.00")).toBeDefined();
  expect(halfPaid.getByText("$113.00")).toBeDefined();
  expect(halfPaid.getByText("Partly paid")).toBeDefined();

  // What the month comes to: invoiced, and still to come in.
  const month = within(rowOf("2 invoices"));
  expect(month.getByText("$363.30")).toBeDefined();
  expect(month.getByText("$250.30")).toBeDefined();

  // A number leads to its invoice, still under "Invoices" on the menu.
  fireEvent.click(screen.getByRole("link", { name: "#12" }));
  expect(
    await screen.findByRole("heading", { name: "Invoice #12" }),
  ).toBeDefined();
  expect(link.getAttribute("aria-current")).toBe("page");
});

test("moves from one month to the next, and back to this one", async () => {
  inNovember();
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      // Nothing was issued outside November.
      "GET /invoices": (request) =>
        json(200, request.url === november ? [aliceInvoice, bobInvoice] : []),
    }),
  );
  renderApp({ route: "/invoices" });
  await screen.findByText("Alice Example");

  fireEvent.click(screen.getByRole("link", { name: "Previous month" }));

  expect(
    await screen.findByText(/^No invoices issued in October 2026\./),
  ).toBeDefined();
  expect(screen.getByRole("heading", { name: "October 2026" })).toBeDefined();
  expect(lastRange(requests)).toBe(
    "http://api.test/invoices?from=2026-10-01&to=2026-10-31",
  );
  // Where one is generated, since this page offers none.
  expect(
    screen.getByRole("link", { name: "calendar" }).getAttribute("href"),
  ).toBe("/calendar");
  expect(
    screen.getByRole("link", { name: "This month" }).getAttribute("href"),
  ).toBe("/invoices");

  // Forward, through this month and past the end of the year.
  fireEvent.click(screen.getByRole("link", { name: "Next month" }));
  await screen.findByText("Alice Example");
  expect(screen.getByRole("heading", { name: "November 2026" })).toBeDefined();
  expect(screen.queryByRole("link", { name: "This month" })).toBeNull();
  fireEvent.click(screen.getByRole("link", { name: "Next month" }));
  fireEvent.click(screen.getByRole("link", { name: "Next month" }));

  expect(
    await screen.findByText(/^No invoices issued in January 2027\./),
  ).toBeDefined();
  expect(lastRange(requests)).toBe(
    "http://api.test/invoices?from=2027-01-01&to=2027-01-31",
  );

  fireEvent.click(screen.getByRole("link", { name: "This month" }));

  await screen.findByText("Alice Example");
  expect(screen.getByRole("heading", { name: "November 2026" })).toBeDefined();
  expect(lastRange(requests)).toBe(november);
});

test("lists the month in the address, through its last day", async () => {
  inNovember();
  // Issued on the last day of a February with 29, and paid in full.
  const paid: Invoice = {
    ...bobInvoice,
    issueDate: "2028-02-29",
    paidCents: 22600,
    amountDueCents: 0,
    paid: true,
    locked: true,
  };
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /invoices": () => json(200, [paid]),
    }),
  );
  renderApp({ route: "/invoices?month=2028-02" });

  await screen.findByText("Bob Sample");
  expect(screen.getByRole("heading", { name: "February 2028" })).toBeDefined();
  expect(lastRange(requests)).toBe(
    "http://api.test/invoices?from=2028-02-01&to=2028-02-29",
  );
  expect(screen.getByRole("link", { name: "This month" })).toBeDefined();

  const row = within(rowOf("#12"));
  expect(row.getByText("Feb 29, 2028")).toBeDefined();
  expect(row.getByText("$226.00")).toBeDefined();
  expect(row.getByText("$0.00")).toBeDefined();
  expect(row.getByText("Paid")).toBeDefined();

  const month = within(rowOf("1 invoice"));
  expect(month.getByText("$226.00")).toBeDefined();
  expect(month.getByText("$0.00")).toBeDefined();
});

test("takes this month where the business is", async () => {
  // 02:00 UTC on December 1 is still the evening of November 30 in Toronto.
  vi.useFakeTimers({
    toFake: ["Date"],
    now: new Date("2026-12-01T02:00:00Z"),
  });
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /invoices": () => json(200, []),
    }),
  );
  renderApp({ route: "/invoices" });

  expect(
    await screen.findByText(/^No invoices issued in November 2026\./),
  ).toBeDefined();
  expect(lastRange(requests)).toBe(november);
});

test.each(["2026-13", "2026-10-05", "october"])(
  "lists this month when the address says %s",
  async (month) => {
    inNovember();
    const requests = mockApi(
      routes({
        "GET /auth/me": () => json(200, session),
        "GET /invoices": () => json(200, []),
      }),
    );
    renderApp({ route: `/invoices?month=${month}` });

    expect(
      await screen.findByRole("heading", { name: "November 2026" }),
    ).toBeDefined();
    await screen.findByText(/^No invoices issued in November 2026\./);
    expect(lastRange(requests)).toBe(november);
    expect(screen.queryByRole("link", { name: "This month" })).toBeNull();
  },
);

test("offers to try again when the invoices fail to load", async () => {
  inNovember();
  let attempts = 0;
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      "GET /invoices": () => {
        attempts += 1;
        return attempts === 1 ? networkFailure() : json(200, [aliceInvoice]);
      },
    }),
  );
  renderApp({ route: "/invoices" });

  expect((await screen.findByRole("alert")).textContent).toContain(
    "Could not reach the API",
  );
  // The month stays in place while its invoices are missing.
  expect(screen.getByRole("heading", { name: "November 2026" })).toBeDefined();

  fireEvent.click(screen.getByRole("button", { name: "Try again" }));

  expect(await screen.findByText("Alice Example")).toBeDefined();
  expect(screen.queryByRole("alert")).toBeNull();
});

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import type { Invoice } from "@/api/invoices.ts";
import type { Payment } from "@/api/payments.ts";
import {
  apiError,
  json,
  mockApi,
  networkFailure,
  noContent,
  routes,
  validationError,
} from "@/test/api.ts";
import { aliceInvoice, bobInvoice, session } from "@/test/fixtures.ts";
import { renderApp } from "@/test/render.tsx";

// 02:00 UTC on the 18th is still the evening of the 17th in Toronto, where
// the organization is: a payment recorded now came in on the 17th.
beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["Date"],
    now: new Date("2026-11-18T02:00:00Z"),
  });
});
afterEach(() => {
  vi.useRealTimers();
});

const alicePath = `/invoices/${aliceInvoice.id}`;
const bobPath = `/invoices/${bobInvoice.id}`;

// Alice's invoice once all of it came in: paid, and closed.
const inFull: Payment = {
  id: "0199c4b0-7d2e-7a10-8c3e-3f1c9a2b4d72",
  paidOn: "2026-11-17",
  method: "e_transfer",
  amountCents: 13730,
  notes: null,
};
const alicePaid: Invoice = {
  ...aliceInvoice,
  paidCents: 13730,
  amountDueCents: 0,
  paid: true,
  locked: true,
  payments: [inFull],
};

// The half Bob paid, as his invoice lists it.
const [firstHalf] = bobInvoice.payments;
if (firstHalf === undefined) {
  throw new Error("Expected a payment on Bob's invoice");
}
const editFirstHalf = "Edit the payment of $113.00 on Nov 18, 2026";

// What the API answers a payment with: the payment, and whose it is.
function recorded(payment: Payment, invoice: Invoice) {
  return {
    ...payment,
    invoiceId: invoice.id,
    createdAt: "2026-11-18T02:00:00.000Z",
    updatedAt: "2026-11-18T02:00:00.000Z",
  };
}

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function valueOf(label: string): string {
  return screen.getByLabelText<Control>(label).value;
}

function click(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

// What the totals say next to this label.
function amountOf(label: string): string | null | undefined {
  return screen.getByText(label, { selector: "dt" }).nextElementSibling
    ?.textContent;
}

// The cells of the payment that came in on this day.
function paymentOn(date: string): (string | null)[] {
  const row = screen.getByText(date, { selector: "td" }).closest("tr");
  if (row === null) {
    throw new Error(`No payment on ${date}`);
  }
  return Array.from(row.cells, (cell) => cell.textContent);
}

// Long enough for a request that was going to be sent to be sent: a
// mutation calls the API a tick after the click.
function aMoment(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 20));
}

test("records all that is due without typing anything", async () => {
  let paid = false;
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      [`GET ${alicePath}`]: () => json(200, paid ? alicePaid : aliceInvoice),
      [`POST ${alicePath}/payments`]: () => {
        paid = true;
        return json(201, recorded(inFull, aliceInvoice));
      },
    }),
  );
  renderApp({ route: alicePath });

  await screen.findByRole("heading", { name: "Invoice #13" });
  expect(screen.getByText("Unpaid")).toBeDefined();
  expect(screen.getByText("No payments yet.")).toBeDefined();
  click("Record payment");

  // The form opens in place of its button, as the payment there usually
  // is: all of it, today where the organization is, by e-transfer.
  expect(
    screen.getByRole("heading", { name: "Record a payment" }),
  ).toBeDefined();
  expect(screen.queryByRole("button", { name: "Record payment" })).toBeNull();
  expect(valueOf("Amount")).toBe("137.30");
  expect(valueOf("Method")).toBe("e_transfer");
  expect(valueOf("Paid on")).toBe("2026-11-17");
  expect(valueOf("Notes")).toBe("");
  // Typing starts at the amount, and Enter there sends the form.
  expect(document.activeElement).toBe(screen.getByLabelText("Amount"));
  click("Save payment");

  // The invoice is asked for again, and says what the payment made of it.
  expect(await screen.findByText("Paid", { selector: "span" })).toBeDefined();
  await waitFor(() => {
    expect(screen.queryByLabelText("Amount")).toBeNull();
  });
  expect(paymentOn("Nov 17, 2026")).toEqual([
    "Nov 17, 2026",
    "E-transfer",
    "—",
    "$137.30",
    "Edit",
  ]);
  expect(amountOf("Paid")).toBe("-$137.30");
  expect(amountOf("Amount due")).toBe("$0.00");
  // Nothing is left to record, and the invoice is closed.
  expect(screen.queryByRole("button", { name: "Record payment" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Edit" })).toBeNull();
  expect(
    screen.getByText(
      "To change the invoice, lower or delete a payment: that opens it again.",
    ),
  ).toBeDefined();

  const sent = requests.filter((r) => r.method === "POST");
  expect(sent).toHaveLength(1);
  expect(sent[0]?.body).toEqual({
    paidOn: "2026-11-17",
    method: "e_transfer",
    amountCents: 13730,
    notes: null,
  });
  expect(
    requests.filter((r) => r.method === "GET" && r.path === alicePath),
  ).toHaveLength(2);
});

test("records a part of what is due, in cash, with a note", async () => {
  const half: Payment = {
    id: "0199c4b0-7d2e-7a10-8c3e-3f1c9a2b4d73",
    paidOn: "2026-11-15",
    method: "cash",
    amountCents: 5000,
    notes: "Half now.",
  };
  const partlyPaid: Invoice = {
    ...aliceInvoice,
    paidCents: 5000,
    amountDueCents: 8730,
    payments: [half],
  };
  let paid = false;
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      [`GET ${alicePath}`]: () => json(200, paid ? partlyPaid : aliceInvoice),
      [`POST ${alicePath}/payments`]: () => {
        paid = true;
        return json(201, recorded(half, aliceInvoice));
      },
    }),
  );
  renderApp({ route: alicePath });

  await screen.findByRole("heading", { name: "Invoice #13" });
  click("Record payment");
  fill("Amount", "50");
  fill("Method", "cash");
  fill("Paid on", "2026-11-15");
  fill("Notes", "  Half now.  ");
  click("Save payment");

  expect(await screen.findByText("Partly paid")).toBeDefined();
  expect(paymentOn("Nov 15, 2026")).toEqual([
    "Nov 15, 2026",
    "Cash",
    "Half now.",
    "$50.00",
    "Edit",
  ]);
  expect(amountOf("Amount due")).toBe("$87.30");
  expect(requests.find((r) => r.method === "POST")?.body).toEqual({
    paidOn: "2026-11-15",
    method: "cash",
    amountCents: 5000,
    notes: "Half now.",
  });

  // The rest can be recorded, and that is what the form now starts from.
  await waitFor(() => {
    expect(screen.queryByLabelText("Amount")).toBeNull();
  });
  click("Record payment");
  expect(valueOf("Amount")).toBe("87.30");
  expect(screen.getByLabelText<HTMLInputElement>("Amount").max).toBe("87.30");
});

test("leaves to the browser an amount the invoice cannot take", async () => {
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      [`GET ${alicePath}`]: () => json(200, aliceInvoice),
    }),
  );
  renderApp({ route: alicePath });

  await screen.findByRole("heading", { name: "Invoice #13" });
  click("Record payment");
  const amount = screen.getByLabelText<HTMLInputElement>("Amount");
  expect(
    screen.getByText(
      "In dollars, at most $137.30: the payments of an invoice never add up to more than its total.",
    ),
  ).toBeDefined();

  // More than is due, nothing, and no amount at all.
  fill("Amount", "137.31");
  expect(amount.validity.rangeOverflow).toBe(true);
  click("Save payment");
  fill("Amount", "0");
  expect(amount.validity.rangeUnderflow).toBe(true);
  click("Save payment");
  fill("Amount", "");
  expect(amount.validity.valueMissing).toBe(true);
  click("Save payment");
  fill("Amount", "137.30");
  expect(amount.validity.valid).toBe(true);
  fill("Paid on", "");
  expect(
    screen.getByLabelText<HTMLInputElement>("Paid on").validity.valueMissing,
  ).toBe(true);
  click("Save payment");

  await aMoment();
  expect(requests.some((r) => r.method === "POST")).toBe(false);
});

test("closes the form without recording anything", async () => {
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      [`GET ${alicePath}`]: () => json(200, aliceInvoice),
    }),
  );
  renderApp({ route: alicePath });

  await screen.findByRole("heading", { name: "Invoice #13" });
  click("Record payment");
  fill("Amount", "50");
  click("Cancel");

  expect(screen.queryByLabelText("Amount")).toBeNull();
  // What was typed is not kept for the next time.
  click("Record payment");
  expect(valueOf("Amount")).toBe("137.30");
  click("Cancel");
  await aMoment();
  expect(requests.every((r) => r.method === "GET")).toBe(true);
});

test("says what the API refused, and keeps what was typed", async () => {
  // Someone recorded a payment since the page was loaded.
  const pastTheTotal = "Must not exceed the amount due of 5000";
  let reachable = false;
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      [`GET ${alicePath}`]: () => json(200, aliceInvoice),
      [`POST ${alicePath}/payments`]: () =>
        reachable
          ? validationError([{ path: "amountCents", message: pastTheTotal }])
          : networkFailure(),
    }),
  );
  renderApp({ route: alicePath });

  await screen.findByRole("heading", { name: "Invoice #13" });
  click("Record payment");
  fill("Amount", "100");
  fill("Notes", "By hand.");
  click("Save payment");

  // A failure that is about no field is said below them.
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Could not reach the API",
  );
  reachable = true;
  click("Save payment");

  // An issue is said under its field.
  expect(await screen.findByText(pastTheTotal)).toBeDefined();
  expect(screen.getByLabelText("Amount").getAttribute("aria-invalid")).toBe(
    "true",
  );
  expect(screen.queryByText(/Could not reach the API/)).toBeNull();
  expect(valueOf("Amount")).toBe("100");
  expect(valueOf("Notes")).toBe("By hand.");
  // Nothing was recorded, so the invoice is not asked for again.
  expect(requests.filter((r) => r.method === "POST")).toHaveLength(2);
  expect(
    requests.filter((r) => r.method === "GET" && r.path === alicePath),
  ).toHaveLength(1);
});

test("corrects a payment and sends only what changed", async () => {
  const inCash: Payment = { ...firstHalf, method: "cash", notes: null };
  const corrected: Invoice = { ...bobInvoice, payments: [inCash] };
  const paymentPath = `/payments/${firstHalf.id}`;
  let saved = false;
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      [`GET ${bobPath}`]: () => json(200, saved ? corrected : bobInvoice),
      [`PATCH ${paymentPath}`]: () => {
        saved = true;
        return json(200, recorded(inCash, bobInvoice));
      },
    }),
  );
  renderApp({ route: bobPath });

  await screen.findByRole("heading", { name: "Invoice #12" });
  click(editFirstHalf);

  // The form starts from the payment, in dollars.
  expect(
    screen.getByRole("heading", { name: "Edit the payment of Nov 18, 2026" }),
  ).toBeDefined();
  expect(valueOf("Amount")).toBe("113.00");
  expect(valueOf("Method")).toBe("e_transfer");
  expect(valueOf("Paid on")).toBe("2026-11-18");
  expect(valueOf("Notes")).toBe("First half.");
  // It may grow by what the invoice still has to receive.
  expect(screen.getByLabelText<HTMLInputElement>("Amount").max).toBe("226.00");
  // The other half is still recorded with its own button, once this is
  // closed.
  expect(screen.queryByRole("button", { name: "Record payment" })).toBeNull();

  fill("Method", "cash");
  fill("Notes", "");
  click("Save changes");

  await waitFor(() => {
    expect(paymentOn("Nov 18, 2026")).toEqual([
      "Nov 18, 2026",
      "Cash",
      "—",
      "$113.00",
      "Edit",
    ]);
  });
  await waitFor(() => {
    expect(screen.queryByLabelText("Amount")).toBeNull();
  });
  expect(screen.getByRole("button", { name: "Record payment" })).toBeDefined();
  const sent = requests.filter((r) => r.method === "PATCH");
  expect(sent.map((r) => r.path)).toEqual([paymentPath]);
  expect(sent[0]?.body).toEqual({ method: "cash", notes: null });
});

test("asks nothing of the API for a payment saved as it was", async () => {
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      [`GET ${bobPath}`]: () => json(200, bobInvoice),
    }),
  );
  renderApp({ route: bobPath });

  await screen.findByRole("heading", { name: "Invoice #12" });
  click(editFirstHalf);
  // Typed again as it is, the amount is the same amount.
  fill("Amount", "113");
  click("Save changes");

  await waitFor(() => {
    expect(screen.queryByLabelText("Amount")).toBeNull();
  });
  expect(requests.every((r) => r.method === "GET")).toBe(true);
});

test("opens the form of one payment at a time", async () => {
  const secondHalf: Payment = {
    id: "0199c4b0-7d2e-7a10-8c3e-3f1c9a2b4d74",
    paidOn: "2026-11-20",
    method: "cash",
    amountCents: 11300,
    notes: null,
  };
  const bothHalves: Invoice = {
    ...bobInvoice,
    paidCents: 22600,
    amountDueCents: 0,
    paid: true,
    locked: true,
    payments: [firstHalf, secondHalf],
  };
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      [`GET ${bobPath}`]: () => json(200, bothHalves),
    }),
  );
  renderApp({ route: bobPath });

  await screen.findByRole("heading", { name: "Invoice #12" });
  // Paid in full: nothing to record, and each payment can be corrected.
  expect(screen.queryByRole("button", { name: "Record payment" })).toBeNull();
  click(editFirstHalf);
  fill("Notes", "Typed and left.");
  const rowOf = (date: string) =>
    screen.getByText(date, { selector: "td" }).closest("tr");
  expect(rowOf("Nov 18, 2026")?.getAttribute("data-state")).toBe("selected");

  click("Edit the payment of $113.00 on Nov 20, 2026");

  // The form is the other payment's, with nothing of the first.
  expect(
    screen.getByRole("heading", { name: "Edit the payment of Nov 20, 2026" }),
  ).toBeDefined();
  expect(valueOf("Method")).toBe("cash");
  expect(valueOf("Paid on")).toBe("2026-11-20");
  expect(valueOf("Notes")).toBe("");
  // Nothing is due, so it can only stay what it is or come down.
  expect(screen.getByLabelText<HTMLInputElement>("Amount").max).toBe("113.00");
  expect(rowOf("Nov 18, 2026")?.getAttribute("data-state")).toBeNull();
  expect(rowOf("Nov 20, 2026")?.getAttribute("data-state")).toBe("selected");
});

test("deletes a payment after asking twice, which opens the invoice again", async () => {
  const paymentPath = `/payments/${inFull.id}`;
  let deleted = false;
  const requests = mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      [`GET ${alicePath}`]: () => json(200, deleted ? aliceInvoice : alicePaid),
      [`DELETE ${paymentPath}`]: () => {
        deleted = true;
        return noContent();
      },
    }),
  );
  renderApp({ route: alicePath });

  await screen.findByRole("heading", { name: "Invoice #13" });
  // Closed: the invoice has no "Edit" of its own, only its payment has.
  expect(screen.queryByRole("link", { name: "Edit" })).toBeNull();
  click("Edit the payment of $137.30 on Nov 17, 2026");
  click("Delete payment");
  expect(screen.getByText("Delete this payment of $137.30?")).toBeDefined();
  // Changing her mind costs nothing.
  click("Keep it");
  expect(screen.queryByText(/Delete this payment/)).toBeNull();
  await aMoment();
  expect(requests.some((r) => r.method === "DELETE")).toBe(false);

  click("Delete payment");
  click("Yes, delete");

  // Nothing came in any more, and the invoice can be changed again.
  expect(await screen.findByText("Unpaid")).toBeDefined();
  expect(screen.getByText("No payments yet.")).toBeDefined();
  expect(amountOf("Amount due")).toBe("$137.30");
  expect(screen.getByRole("link", { name: "Edit" })).toBeDefined();
  expect(screen.queryByText(/lower or delete a payment/)).toBeNull();
  await waitFor(() => {
    expect(
      screen.getByRole("button", { name: "Record payment" }),
    ).toBeDefined();
  });
  expect(screen.queryByLabelText("Amount")).toBeNull();
  expect(requests.filter((r) => r.method === "DELETE")).toHaveLength(1);
});

test("says why a payment was not changed or deleted, and keeps it", async () => {
  const paymentPath = `/payments/${firstHalf.id}`;
  // Deleted from somewhere else since the page was loaded.
  const gone = "Payment not found";
  mockApi(
    routes({
      "GET /auth/me": () => json(200, session),
      [`GET ${bobPath}`]: () => json(200, bobInvoice),
      [`PATCH ${paymentPath}`]: () => apiError(404, "not_found", gone),
      [`DELETE ${paymentPath}`]: () => apiError(404, "not_found", gone),
    }),
  );
  renderApp({ route: bobPath });

  await screen.findByRole("heading", { name: "Invoice #12" });
  click(editFirstHalf);
  fill("Amount", "100");
  click("Save changes");

  expect((await screen.findByRole("alert")).textContent).toBe(gone);
  // Still open, with what was typed.
  expect(valueOf("Amount")).toBe("100");

  click("Delete payment");
  click("Yes, delete");

  await waitFor(() => {
    expect(screen.getAllByRole("alert")).toHaveLength(2);
  });
  // What a refused attempt said goes with the question.
  click("Keep it");
  expect(screen.getAllByRole("alert")).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Delete payment" })).toBeDefined();
});

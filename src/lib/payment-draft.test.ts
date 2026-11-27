import { expect, test } from "vitest";

import type { Payment } from "@/api/payments.ts";
import {
  fromDraft,
  maxPaymentCents,
  newPaymentDraft,
  toDraft,
} from "./payment-draft.ts";

const firstHalf: Payment = {
  id: "0199c4b0-7d2e-7a10-8c3e-3f1c9a2b4d70",
  paidOn: "2026-11-18",
  method: "cash",
  amountCents: 11300,
  notes: "First half.",
};

test("starts a new payment as all that is due, today, by e-transfer", () => {
  expect(newPaymentDraft(13730, "2026-11-17")).toEqual({
    amount: "137.30",
    method: "e_transfer",
    paidOn: "2026-11-17",
    notes: "",
  });
});

test("gives back the payment a form was filled from", () => {
  expect(toDraft(firstHalf)).toEqual({
    amount: "113.00",
    method: "cash",
    paidOn: "2026-11-18",
    notes: "First half.",
  });
  const { id: _id, ...input } = firstHalf;
  expect(fromDraft(toDraft(firstHalf))).toEqual(input);
});

test("sends dollars as cents and blank notes as null", () => {
  expect(
    fromDraft({
      amount: "19.99",
      method: "e_transfer",
      paidOn: "2026-11-17",
      notes: "  ",
    }),
  ).toEqual({
    paidOn: "2026-11-17",
    method: "e_transfer",
    amountCents: 1999,
    notes: null,
  });
});

test("lets a new payment be all that is still due", () => {
  expect(maxPaymentCents(11300)).toBe(11300);
});

test("lets a payment grow by what is still due", () => {
  expect(maxPaymentCents(11300, 11300)).toBe(22600);
  // Paid in full: it can only stay or come down.
  expect(maxPaymentCents(0, 22600)).toBe(22600);
});

test("lets a payment stay what it is on an invoice edited below it", () => {
  // $150.00 came in for an invoice that is $100.00 now: $50.00 too much.
  expect(maxPaymentCents(-5000, 15000)).toBe(15000);
  // One of two payments that are $130.00 too much together: without it
  // the invoice still received more than its total.
  expect(maxPaymentCents(-13000, 8000)).toBe(8000);
});

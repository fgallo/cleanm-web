import type { Payment, PaymentInput, PaymentMethod } from "@/api/payments.ts";
import { centsToDollars, dollarsToCents, emptyAsNull } from "@/lib/form.ts";

// A payment while it is typed: the amount in dollars. Cents are what is
// sent.
export type PaymentDraft = {
  amount: string;
  method: PaymentMethod;
  paidOn: string;
  notes: string;
};

// The names the API gives these fields in its issues.
export const paymentFieldNames = [
  "amountCents",
  "method",
  "paidOn",
  "notes",
] as const;

// A new payment is all the invoice still has to receive, come in today by
// e-transfer: the payment there usually is, so that recording it takes no
// typing.
export function newPaymentDraft(
  amountDueCents: number,
  today: string,
): PaymentDraft {
  return {
    amount: centsToDollars(amountDueCents),
    method: "e_transfer",
    paidOn: today,
    notes: "",
  };
}

export function toDraft(payment: Payment): PaymentDraft {
  return {
    amount: centsToDollars(payment.amountCents),
    method: payment.method,
    paidOn: payment.paidOn,
    notes: payment.notes ?? "",
  };
}

export function fromDraft(draft: PaymentDraft): PaymentInput {
  return {
    paidOn: draft.paidOn,
    method: draft.method,
    amountCents: dollarsToCents(draft.amount),
    notes: emptyAsNull(draft.notes),
  };
}

// The most a payment may be: what it is now and what the invoice still has
// to receive, as the API counts it. Never less than what it is, which is
// not sent again, even on an invoice that was edited below what it
// received. A payment being recorded is nothing yet.
export function maxPaymentCents(
  amountDueCents: number,
  currentCents = 0,
): number {
  return Math.max(amountDueCents + currentCents, currentCents);
}

import { del, patch, post } from "./client.ts";

export const paymentMethods = ["e_transfer", "cash"] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

// Money received for an invoice, as the invoice lists it (`payments` on
// `Invoice`). Several may cover one invoice, which is paid once they reach
// its total. `paidOn` is a day, YYYY-MM-DD, without a time zone. No request
// reads payments on their own: the API gives them with their invoice.
export type Payment = {
  id: string;
  paidOn: string;
  method: PaymentMethod;
  amountCents: number;
  notes: string | null;
};

// What is said of a payment, when it is recorded and when it is corrected.
export type PaymentInput = Omit<Payment, "id">;

// A payment as an update is compared with it.
export function toPaymentInput(payment: Payment): PaymentInput {
  return {
    paidOn: payment.paidOn,
    method: payment.method,
    amountCents: payment.amountCents,
    notes: payment.notes,
  };
}

// POST /invoices/:invoiceId/payments: money that came in for an invoice.
// The API refuses (`400` on `amountCents`) more than the invoice still has
// to receive, so its payments never go past its total. It answers with the
// payment alone, while what a payment changes is its invoice (what was
// paid, what is due, whether it is closed): whoever records, corrects or
// deletes one asks for the invoice again.
export function createPayment(
  invoiceId: string,
  input: PaymentInput,
): Promise<Payment> {
  return post<Payment>(`/invoices/${invoiceId}/payments`, input);
}

// Sends only the fields that differ from `payment`, like `updateJob`. The
// amount may grow by what the invoice still has to receive, and the API
// only checks it when it is sent: a payment of an invoice that was edited
// below what it received keeps its amount and can still have its day, its
// method or its notes corrected.
export function updatePayment(
  payment: Payment,
  input: PaymentInput,
): Promise<Payment> {
  const current = toPaymentInput(payment);
  const changes = Object.fromEntries(
    Object.entries(input).filter(
      ([field, value]) => value !== current[field as keyof PaymentInput],
    ),
  );
  // Nothing to ask of the API, which takes no empty update either.
  if (Object.keys(changes).length === 0) {
    return Promise.resolve(payment);
  }
  return patch<Payment>(`/payments/${payment.id}`, changes);
}

// Takes the amount off what the invoice received. An invoice that was paid
// in full is open again.
export function deletePayment(id: string): Promise<void> {
  return del(`/payments/${id}`);
}

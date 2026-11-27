import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Temporal } from "temporal-polyfill";

import { describeFailure } from "@/api/client.ts";
import { invoiceKeys, type Invoice } from "@/api/invoices.ts";
import {
  createPayment,
  deletePayment,
  updatePayment,
  type Payment,
  type PaymentInput,
} from "@/api/payments.ts";
import { useSession } from "@/auth/session-context.ts";
import AskTwice from "@/components/ask-twice.tsx";
import PaymentForm from "@/components/payment-form.tsx";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/format.ts";
import { paymentMethodLabels } from "@/lib/invoice-labels.ts";
import {
  maxPaymentCents,
  newPaymentDraft,
  toDraft,
} from "@/lib/payment-draft.ts";

// What is open under the list: nothing, the form that records a payment,
// or the form of a payment that exists.
type OpenForm =
  { form: "none" } | { form: "new" } | { form: "edit"; paymentId: string };

const closed: OpenForm = { form: "none" };

function day(date: string): string {
  return formatDate(Temporal.PlainDate.from(date));
}

// The payments of an invoice, on its page: the list, and under it the form
// that records one or corrects one. A payment has no page of its own, as it
// has no list in the API: it is part of its invoice, and the totals it
// changes are right above. This part of the page owns its requests, as a
// page does for its form.
export default function InvoicePayments({ invoice }: { invoice: Invoice }) {
  const [open, setOpen] = useState(closed);
  const close = () => setOpen(closed);
  const recording = open.form === "new";
  // Looked up in the invoice as it is now: a payment that is gone since its
  // form was opened has no form.
  const editing =
    open.form === "edit"
      ? invoice.payments.find((payment) => payment.id === open.paymentId)
      : undefined;

  return (
    <section className="mt-8">
      <h2 className="font-heading text-base font-medium">Payments</h2>
      {invoice.payments.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">No payments yet.</p>
      ) : (
        <Table className="mt-1">
          <TableHeader>
            <TableRow>
              <TableHead>Paid on</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoice.payments.map((payment) => (
              <TableRow
                key={payment.id}
                data-state={payment.id === editing?.id ? "selected" : undefined}
              >
                <TableCell>{day(payment.paidOn)}</TableCell>
                <TableCell>{paymentMethodLabels[payment.method]}</TableCell>
                <TableCell>
                  {payment.notes ?? (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {formatMoney(payment.amountCents)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Edit the payment of ${formatMoney(payment.amountCents)} on ${day(payment.paidOn)}`}
                    onClick={() =>
                      setOpen({ form: "edit", paymentId: payment.id })
                    }
                  >
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {invoice.locked && (
        <p className="mt-2 text-sm text-muted-foreground">
          To change the invoice, lower or delete a payment: that opens it again.
        </p>
      )}
      {/* Nothing more is recorded once nothing is due: the API refuses it. */}
      {!recording && editing === undefined && invoice.amountDueCents > 0 && (
        <Button
          size="sm"
          className="mt-3"
          onClick={() => setOpen({ form: "new" })}
        >
          Record payment
        </Button>
      )}
      {recording && <RecordPayment invoice={invoice} onDone={close} />}
      {/* Mounted per payment: the form copies it into its state. */}
      {editing !== undefined && (
        <EditPayment
          key={editing.id}
          invoice={invoice}
          payment={editing}
          onDone={close}
        />
      )}
    </section>
  );
}

// What a payment changes is its invoice: what was paid, what is due and
// whether it is closed, all derived by the API, which answers a payment
// with the payment alone. So the invoice is asked for again, and whoever
// waits for this keeps its form until the page shows the answer. The lists
// say what each invoice still has to receive, and are asked for again too.
function useInvoiceAgain(invoiceId: string): () => Promise<void> {
  const queryClient = useQueryClient();
  return async () => {
    void queryClient.invalidateQueries({ queryKey: invoiceKeys.ranges() });
    await queryClient.invalidateQueries({
      queryKey: invoiceKeys.detail(invoiceId),
    });
  };
}

function RecordPayment({
  invoice,
  onDone,
}: {
  invoice: Invoice;
  onDone: () => void;
}) {
  const { organization } = useSession();
  const invoiceAgain = useInvoiceAgain(invoice.id);
  const record = useMutation({
    mutationFn: (input: PaymentInput) => createPayment(invoice.id, input),
    onSuccess: async () => {
      await invoiceAgain();
      onDone();
    },
  });

  return (
    <div className="mt-3 rounded-lg border p-4">
      <h3 className="mb-4 font-heading text-sm font-medium">
        Record a payment
      </h3>
      <PaymentForm
        // All that is still due, come in today, which is a day where the
        // organization is, not where the browser is.
        initial={newPaymentDraft(
          invoice.amountDueCents,
          Temporal.Now.plainDateISO(organization.timezone).toString(),
        )}
        maxCents={maxPaymentCents(invoice.amountDueCents)}
        submitLabel="Save payment"
        pending={record.isPending}
        error={record.error}
        onSubmit={record.mutate}
        onCancel={onDone}
      />
    </div>
  );
}

// Correcting a payment, or deleting it, is also how an invoice paid in full
// is opened again. Deleting asks twice: the payment cannot be brought back.
function EditPayment({
  invoice,
  payment,
  onDone,
}: {
  invoice: Invoice;
  payment: Payment;
  onDone: () => void;
}) {
  const invoiceAgain = useInvoiceAgain(invoice.id);
  const [asking, setAsking] = useState(false);
  const update = useMutation({
    mutationFn: (input: PaymentInput) => updatePayment(payment, input),
    onSuccess: async () => {
      await invoiceAgain();
      onDone();
    },
  });
  const remove = useMutation({
    mutationFn: () => deletePayment(payment.id),
    onSuccess: async () => {
      await invoiceAgain();
      onDone();
    },
  });
  // One request at a time about the same payment.
  const pending = update.isPending || remove.isPending;

  return (
    <div className="mt-3 rounded-lg border p-4">
      <h3 className="mb-4 font-heading text-sm font-medium">
        Edit the payment of {day(payment.paidOn)}
      </h3>
      <PaymentForm
        initial={toDraft(payment)}
        maxCents={maxPaymentCents(invoice.amountDueCents, payment.amountCents)}
        submitLabel="Save changes"
        pending={pending}
        error={update.error}
        onSubmit={update.mutate}
        onCancel={onDone}
      />
      <div className="mt-4 border-t pt-1">
        <AskTwice
          label="Delete payment"
          question={`Delete this payment of ${formatMoney(payment.amountCents)}?`}
          confirmLabel="Yes, delete"
          cancelLabel="Keep it"
          destructive
          asking={asking}
          pending={pending}
          onAsk={() => setAsking(true)}
          onConfirm={() => remove.mutate()}
          onCancel={() => {
            setAsking(false);
            // What a refused attempt said goes with it.
            remove.reset();
          }}
        />
        {remove.isError && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {describeFailure(remove.error)}
          </p>
        )}
      </div>
    </div>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Temporal } from "temporal-polyfill";

import { describeFailure, isNotFound } from "@/api/client.ts";
import {
  canBeDeleted,
  deleteInvoice,
  invoiceKeys,
  invoicePdfUrl,
  invoiceQueryOptions,
  refreshInvoice,
  type Invoice,
} from "@/api/invoices.ts";
import { jobKeys } from "@/api/jobs.ts";
import AskTwice from "@/components/ask-twice.tsx";
import InvoicePaidBadge from "@/components/invoice-paid-badge.tsx";
import RequestFailed from "@/components/request-failed.tsx";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cityLine } from "@/lib/address.ts";
import { formatDate, formatHours, formatMoney } from "@/lib/format.ts";
import {
  discountLabel,
  paymentMethodLabels,
  taxLabel,
} from "@/lib/invoice-labels.ts";

export default function InvoicePage() {
  const { invoiceId } = useParams();
  if (invoiceId === undefined) {
    throw new Error("InvoicePage is rendered without an :invoiceId parameter");
  }
  return <InvoiceDetails invoiceId={invoiceId} />;
}

function InvoiceDetails({ invoiceId }: { invoiceId: string }) {
  const invoice = useQuery(invoiceQueryOptions(invoiceId));

  return (
    <>
      {invoice.isPending && <p className="text-muted-foreground">Loading…</p>}
      {invoice.isError &&
        (isNotFound(invoice.error) ? (
          <>
            <p role="alert">Invoice not found.</p>
            <p className="mt-4 text-sm">
              <Link
                to="/calendar"
                className="text-muted-foreground hover:text-foreground"
              >
                Back to calendar
              </Link>
            </p>
          </>
        ) : (
          <RequestFailed
            error={invoice.error}
            onRetry={() => void invoice.refetch()}
          />
        ))}
      {invoice.isSuccess && <InvoiceView invoice={invoice.data} />}
    </>
  );
}

function day(date: string): string {
  return formatDate(Temporal.PlainDate.from(date));
}

// The invoice as the API keeps it, line by line as its PDF prints it: who
// is billed, the item, the amounts and what was paid. Everything here is
// the invoice's own copy, not the client or the job as they are today.
function InvoiceView({ invoice }: { invoice: Invoice }) {
  const { billTo } = invoice;
  const hourly = invoice.fixedPriceCents === null;

  return (
    <div className="max-w-2xl">
      <p className="mb-4 text-sm">
        <Link
          to={`/calendar/${invoice.job.scheduledDate}`}
          className="text-muted-foreground hover:text-foreground"
        >
          Back to the day of the visit
        </Link>
      </p>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-xl font-semibold">
              Invoice #{invoice.number}
            </h1>
            <InvoicePaidBadge invoice={invoice} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Issued {day(invoice.issueDate)} · Service on{" "}
            {day(invoice.serviceDate)} ·{" "}
            {invoice.dueDate === null
              ? "Due on receipt"
              : `Due ${day(invoice.dueDate)}`}
          </p>
          {invoice.locked && (
            <p className="mt-1 text-sm text-muted-foreground">
              Paid in full, so it is closed: it can no longer be edited or
              deleted while its payments cover the total.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {!invoice.locked && (
            <Link
              to={`/invoices/${invoice.id}/edit`}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Edit
            </Link>
          )}
          {/* A link, not a request of this page: the browser opens the PDF
              itself, in another tab. */}
          <a
            href={invoicePdfUrl(invoice.id)}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Open PDF
          </a>
        </div>
      </div>

      <section className="mt-6">
        <h2 className="font-heading text-base font-medium">Bill to</h2>
        <address className="mt-1 text-sm not-italic">
          <div>
            <Link
              to={`/clients/${invoice.clientId}`}
              className="hover:underline"
            >
              {billTo.name}
            </Link>
          </div>
          <div>{billTo.addressLine1}</div>
          {billTo.addressLine2 !== null && <div>{billTo.addressLine2}</div>}
          <div>{cityLine(billTo)}</div>
          {billTo.email !== null && (
            <div className="text-muted-foreground">{billTo.email}</div>
          )}
          {billTo.phone !== null && (
            <div className="text-muted-foreground">{billTo.phone}</div>
          )}
        </address>
      </section>

      <Table className="mt-6">
        <TableHeader>
          <TableRow>
            <TableHead>Items</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>{invoice.item}</TableCell>
            <TableCell>
              {invoice.description ?? (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            {/* By the hour, or one visit at the price agreed. */}
            <TableCell className="text-right">
              {hourly ? formatHours(invoice.durationMinutes) : "1"}
            </TableCell>
            <TableCell className="text-right">
              {formatMoney(invoice.fixedPriceCents ?? invoice.hourlyRateCents)}
            </TableCell>
            <TableCell className="text-right">
              {formatMoney(invoice.subtotalCents)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <dl className="mt-4 ml-auto grid w-72 grid-cols-[1fr_auto] gap-x-6 gap-y-1 px-2 text-sm">
        <Amount label="Subtotal">{formatMoney(invoice.subtotalCents)}</Amount>
        {invoice.discountCents !== 0 && (
          <Amount label={discountLabel(invoice)}>
            {formatMoney(-invoice.discountCents)}
          </Amount>
        )}
        {invoice.taxRateBasisPoints !== 0 && (
          <Amount label={taxLabel(invoice)}>
            {formatMoney(invoice.taxCents)}
          </Amount>
        )}
        <Amount label="Total" strong>
          {formatMoney(invoice.totalCents)}
        </Amount>
        {invoice.paidCents !== 0 && (
          <Amount label="Paid">{formatMoney(-invoice.paidCents)}</Amount>
        )}
        <Amount label="Amount due" strong>
          {formatMoney(invoice.amountDueCents)}
        </Amount>
      </dl>

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
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.payments.map((payment) => (
                <TableRow key={payment.id}>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {invoice.notes !== null && (
        <section className="mt-8">
          <h2 className="font-heading text-base font-medium">Notes</h2>
          <p className="mt-1 text-sm whitespace-pre-line">{invoice.notes}</p>
        </section>
      )}

      {/* The API refuses both on an invoice paid in full. */}
      {!invoice.locked && (
        <>
          <RefreshDetails invoice={invoice} />
          <DeleteInvoice invoice={invoice} />
        </>
      )}
    </div>
  );
}

// An invoice keeps its own copy of the client, the address and the
// business, so correcting them elsewhere does not reach it. Copying them
// again is asked twice: the copy it had is not kept.
function RefreshDetails({ invoice }: { invoice: Invoice }) {
  const queryClient = useQueryClient();
  const [asking, setAsking] = useState(false);
  const refresh = useMutation({
    mutationFn: () => refreshInvoice(invoice.id),
    onSuccess: (refreshed) => {
      queryClient.setQueryData(invoiceKeys.detail(refreshed.id), refreshed);
      // A list reads who the invoice bills.
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.ranges() });
      setAsking(false);
    },
  });

  return (
    <section className="mt-8 border-t pt-4">
      <h2 className="font-heading text-base font-medium">
        Client and business details
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The invoice prints the client, the address and the business as they were
        when it was generated. Refreshing copies them again as they are now, for
        an invoice issued with something wrong in them.
      </p>
      <AskTwice
        label="Refresh details"
        question="Replace what the invoice prints with the current details?"
        confirmLabel="Yes, refresh"
        cancelLabel="Keep them"
        asking={asking}
        pending={refresh.isPending}
        onAsk={() => {
          // What the previous refresh said goes with it.
          refresh.reset();
          setAsking(true);
        }}
        onConfirm={() => refresh.mutate()}
        onCancel={() => {
          setAsking(false);
          refresh.reset();
        }}
      />
      {refresh.isSuccess && (
        <p role="status" className="mt-2 text-sm">
          The invoice now prints the current details.
        </p>
      )}
      {refresh.isError && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {describeFailure(refresh.error)}
        </p>
      )}
    </section>
  );
}

// Asked twice: the invoice cannot be brought back, and its number is not
// given again. Only while nobody paid any of it.
function DeleteInvoice({ invoice }: { invoice: Invoice }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [asking, setAsking] = useState(false);
  const remove = useMutation({
    mutationFn: () => deleteInvoice(invoice.id),
    onSuccess: async () => {
      // The job has no invoice now, on every list and on its own, and its
      // month has one less. Only the lists of invoices are asked for again:
      // this page still reads the one that is gone.
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.ranges() });
      await queryClient.invalidateQueries({ queryKey: jobKeys.all });
      void navigate(`/calendar/${invoice.job.scheduledDate}`);
    },
  });

  return (
    <section className="mt-8 border-t pt-4">
      <h2 className="font-heading text-base font-medium">Delete invoice</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Removes the invoice, and the visit can be invoiced again. Its number, #
        {invoice.number}, is not given to another invoice.
      </p>
      {canBeDeleted(invoice) ? (
        <AskTwice
          label="Delete invoice"
          question={`Delete invoice #${invoice.number}?`}
          confirmLabel="Yes, delete"
          cancelLabel="Keep it"
          destructive
          asking={asking}
          pending={remove.isPending}
          onAsk={() => setAsking(true)}
          onConfirm={() => remove.mutate()}
          onCancel={() => {
            setAsking(false);
            // What a refused attempt said goes with it.
            remove.reset();
          }}
        />
      ) : (
        <p className="mt-2 text-sm">
          It has payments, and an invoice with payments cannot be deleted.
        </p>
      )}
      {remove.isError && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {describeFailure(remove.error)}
        </p>
      )}
    </section>
  );
}

function Amount({
  label,
  strong = false,
  children,
}: {
  label: string;
  strong?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <dt className={cn(strong ? "font-medium" : "text-muted-foreground")}>
        {label}
      </dt>
      <dd className={cn("text-right", strong && "font-medium")}>{children}</dd>
    </>
  );
}

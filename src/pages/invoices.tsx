import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { Temporal } from "temporal-polyfill";

import { invoicesQueryOptions, type Invoice } from "@/api/invoices.ts";
import { useSession } from "@/auth/session-context.ts";
import InvoicePaidBadge from "@/components/invoice-paid-badge.tsx";
import RequestFailed from "@/components/request-failed.tsx";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { monthRange, parseMonth } from "@/lib/dates.ts";
import { formatDate, formatMoney, formatMonth } from "@/lib/format.ts";

function monthPath(month: Temporal.PlainYearMonth): string {
  return `/invoices?month=${month.toString()}`;
}

// The invoices issued in one month, the latest first, with what each still
// has to receive. The month is in the address (`?month=YYYY-MM`), so the
// arrows are links and a month can be returned to; without one, or with
// anything that is not a month, it is the month the business is in. No
// invoice is generated here: each is the invoice of a job, generated on the
// page of its day.
export default function InvoicesPage() {
  const { organization } = useSession();
  const [searchParams] = useSearchParams();
  const thisMonth = Temporal.Now.plainDateISO(
    organization.timezone,
  ).toPlainYearMonth();
  const month = parseMonth(searchParams.get("month") ?? "") ?? thisMonth;
  const invoices = useQuery(invoicesQueryOptions(monthRange(month)));

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="font-heading text-xl font-semibold">Invoices</h1>
        <div className="flex items-center gap-2">
          {!month.equals(thisMonth) && (
            <Link
              to="/invoices"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              This month
            </Link>
          )}
          <Link
            to={monthPath(month.subtract({ months: 1 }))}
            aria-label="Previous month"
            className={cn(
              buttonVariants({ variant: "outline", size: "icon-sm" }),
            )}
          >
            <ChevronLeft />
          </Link>
          <h2 className="min-w-36 text-center font-medium">
            {formatMonth(month)}
          </h2>
          <Link
            to={monthPath(month.add({ months: 1 }))}
            aria-label="Next month"
            className={cn(
              buttonVariants({ variant: "outline", size: "icon-sm" }),
            )}
          >
            <ChevronRight />
          </Link>
        </div>
      </div>
      {invoices.isPending && <p className="text-muted-foreground">Loading…</p>}
      {invoices.isError && (
        <RequestFailed
          error={invoices.error}
          onRetry={() => void invoices.refetch()}
        />
      )}
      {invoices.isSuccess &&
        (invoices.data.length === 0 ? (
          <p className="text-muted-foreground">
            No invoices issued in {formatMonth(month)}. An invoice is generated
            from a job, on the page of its day in the{" "}
            <Link to="/calendar" className="underline hover:text-foreground">
              calendar
            </Link>
            .
          </p>
        ) : (
          <InvoiceTable invoices={invoices.data} />
        ))}
    </>
  );
}

function sumOf(invoices: Invoice[], amount: (invoice: Invoice) => number) {
  return invoices.reduce((sum, invoice) => sum + amount(invoice), 0);
}

// One row per invoice, in the order the API gives them, and what the month
// comes to below: what was invoiced and what of it is still to come in.
function InvoiceTable({ invoices }: { invoices: Invoice[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Invoice</TableHead>
          <TableHead>Issued</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Address</TableHead>
          <TableHead>Item</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Amount due</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((invoice) => (
          <TableRow key={invoice.id}>
            <TableCell className="font-medium">
              <Link to={`/invoices/${invoice.id}`} className="hover:underline">
                #{invoice.number}
              </Link>
            </TableCell>
            <TableCell>
              {formatDate(Temporal.PlainDate.from(invoice.issueDate))}
            </TableCell>
            {/* Who the invoice bills, as it prints them: its own copy. */}
            <TableCell>
              <Link
                to={`/clients/${invoice.clientId}`}
                className="hover:underline"
              >
                {invoice.billTo.name}
              </Link>
            </TableCell>
            <TableCell>{invoice.billTo.addressLine1}</TableCell>
            {/* An item written out can be long; the invoice has it whole. */}
            <TableCell className="max-w-64 truncate" title={invoice.item}>
              {invoice.item}
            </TableCell>
            <TableCell className="text-right">
              {formatMoney(invoice.totalCents)}
            </TableCell>
            <TableCell className="text-right">
              {formatMoney(invoice.amountDueCents)}
            </TableCell>
            <TableCell>
              <InvoicePaidBadge invoice={invoice} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={5}>
            {invoices.length === 1
              ? "1 invoice"
              : `${String(invoices.length)} invoices`}
          </TableCell>
          <TableCell className="text-right">
            {formatMoney(sumOf(invoices, (invoice) => invoice.totalCents))}
          </TableCell>
          <TableCell className="text-right">
            {formatMoney(sumOf(invoices, (invoice) => invoice.amountDueCents))}
          </TableCell>
          <TableCell />
        </TableRow>
      </TableFooter>
    </Table>
  );
}

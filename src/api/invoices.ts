import { queryOptions } from "@tanstack/react-query";

import { apiUrl, del, get, patch, post } from "./client.ts";
import type { DateRange, Job, JobStatus } from "./jobs.ts";

export const paymentMethods = ["e_transfer", "cash"] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

// The shape GET /invoices/:id returns. An invoice bills one visit and keeps
// its own copy of what it prints: the pricing, the tax, who it bills and who
// issues it. Editing the job, the client, the property or the organization
// later does not change it (brief, design rules 5 and 7). Its dates are
// YYYY-MM-DD, without a time zone.
export type Invoice = {
  id: string;
  // Sequential per organization.
  number: number;
  issueDate: string;
  // `null` means due on receipt.
  dueDate: string | null;
  // The line it prints: what it is for, and what may be written next to it.
  item: string;
  description: string | null;
  serviceDate: string;
  // When `fixedPriceCents` is null, the subtotal is hourly rate x duration.
  durationMinutes: number;
  hourlyRateCents: number;
  fixedPriceCents: number | null;
  subtotalCents: number;
  // A discount as an amount or as a share of the subtotal (1000 is 10%), at
  // most one of the two; `discountCents` is what it takes off.
  fixedDiscountCents: number | null;
  discountBasisPoints: number | null;
  discountCents: number;
  discountDescription: string | null;
  // The tax applies to the discounted subtotal.
  taxName: string | null;
  taxRateBasisPoints: number;
  taxRegistrationNumber: string | null;
  taxCents: number;
  totalCents: number;
  // Derived from the payments. `amountDueCents` goes negative when the
  // invoice was edited below what was already paid.
  paidCents: number;
  amountDueCents: number;
  paid: boolean;
  // Paid in full by payments: the API no longer edits it until its payments
  // change.
  locked: boolean;
  payments: {
    id: string;
    paidOn: string;
    method: PaymentMethod;
    amountCents: number;
    notes: string | null;
  }[];
  notes: string | null;
  billTo: {
    name: string;
    email: string | null;
    phone: string | null;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    province: string;
    postalCode: string;
    country: string;
  };
  issuer: {
    name: string;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    province: string | null;
    postalCode: string | null;
    country: string;
    phone: string | null;
    email: string | null;
    website: string | null;
    paymentInstructions: string | null;
  };
  // The visit, its client and its property as they are now, to link to
  // them. What the invoice prints about them is in `billTo`.
  job: { id: string; scheduledDate: string; status: JobStatus };
  clientId: string;
  propertyId: string;
  createdAt: string;
  updatedAt: string;
};

export const invoiceKeys = {
  all: ["invoices"] as const,
  // Every list of invoices, whatever its days: what a change to one invoice
  // makes stale.
  ranges: () => [...invoiceKeys.all, "range"] as const,
  range: ({ from, to }: DateRange) =>
    [...invoiceKeys.ranges(), from, to] as const,
  detail: (id: string) => [...invoiceKeys.all, "detail", id] as const,
};

// GET /invoices?from=&to=: the invoices issued between two days, both
// included, the latest first. Each comes whole, as its own page reads it.
export function invoicesQueryOptions(range: DateRange) {
  return queryOptions({
    queryKey: invoiceKeys.range(range),
    queryFn: () =>
      get<Invoice[]>(`/invoices?from=${range.from}&to=${range.to}`),
  });
}

export function invoiceQueryOptions(id: string) {
  return queryOptions({
    queryKey: invoiceKeys.detail(id),
    queryFn: () => get<Invoice>(`/invoices/${id}`),
  });
}

// Where the API renders the invoice as a PDF, on request. An address for a
// link, not for `fetch`: the browser opens it itself, and the session cookie
// travels with a navigation to the API.
export function invoicePdfUrl(id: string): string {
  return `${apiUrl}/invoices/${id}/pdf`;
}

// What the owner decides when an invoice is generated: its dates, its line,
// a discount and the notes. The pricing is the job's and the tax the
// organization's, and the API copies both. A discount is an amount or a
// share of the subtotal, never both.
export type InvoiceInput = {
  issueDate: string;
  dueDate: string | null;
  item: string;
  description: string | null;
  fixedDiscountCents: number | null;
  discountBasisPoints: number | null;
  discountDescription: string | null;
  notes: string | null;
};

// A visit is invoiced once, before or after it happens: the API refuses a
// job that is only an estimate, one that was cancelled and one that already
// has an invoice.
export function canBeInvoiced(job: Pick<Job, "status" | "invoice">): boolean {
  return (
    job.invoice === null &&
    (job.status === "scheduled" || job.status === "completed")
  );
}

// POST /invoices: the invoice of one job. It takes the organization's next
// number, which no other invoice gets afterwards, even if this one is
// deleted.
export function createInvoice(
  input: InvoiceInput & { jobId: string },
): Promise<Invoice> {
  return post<Invoice>("/invoices", input);
}

// What can change on an invoice that exists, as PATCH /invoices/:id takes
// it: what was decided when it was generated, and what it copied from the
// job then, the day of the visit and the pricing. The number, the tax and
// who it bills are not here.
export type InvoiceChanges = InvoiceInput & {
  serviceDate: string;
  durationMinutes: number;
  hourlyRateCents: number;
  // `null` charges the hourly rate x the duration.
  fixedPriceCents: number | null;
};

// An invoice as an update is compared with it.
export function toInvoiceChanges(invoice: Invoice): InvoiceChanges {
  return {
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    serviceDate: invoice.serviceDate,
    item: invoice.item,
    description: invoice.description,
    durationMinutes: invoice.durationMinutes,
    hourlyRateCents: invoice.hourlyRateCents,
    fixedPriceCents: invoice.fixedPriceCents,
    fixedDiscountCents: invoice.fixedDiscountCents,
    discountBasisPoints: invoice.discountBasisPoints,
    discountDescription: invoice.discountDescription,
    notes: invoice.notes,
  };
}

// Sends only the fields that differ from `invoice`, like `updateJob`. The
// API checks the rules between fields (the due date against the issue date,
// an amount off against the subtotal) on the invoice as it will be, so the
// fields that stay need not travel. It refuses (`409`) an invoice paid in
// full.
export function updateInvoice(
  invoice: Invoice,
  input: InvoiceChanges,
): Promise<Invoice> {
  const current = toInvoiceChanges(invoice);
  const changes = Object.fromEntries(
    Object.entries(input).filter(
      ([field, value]) => value !== current[field as keyof InvoiceChanges],
    ),
  );
  // Nothing to ask of the API, which takes no empty update either.
  if (Object.keys(changes).length === 0) {
    return Promise.resolve(invoice);
  }
  return patch<Invoice>(`/invoices/${invoice.id}`, changes);
}

// POST /invoices/:id/refresh: copies who the invoice bills and who issues
// it again, from the client, the property and the organization as they are
// now. On purpose, for an invoice issued with something wrong in them: the
// copy it had is not kept. Refused (`409`) on an invoice paid in full.
export function refreshInvoice(id: string): Promise<Invoice> {
  return post<Invoice>(`/invoices/${id}/refresh`);
}

// An invoice with payments stays: the API refuses to delete it (`409`).
export function canBeDeleted(invoice: Pick<Invoice, "payments">): boolean {
  return invoice.payments.length === 0;
}

// Frees the job for another invoice. The number is not given again.
export function deleteInvoice(id: string): Promise<void> {
  return del(`/invoices/${id}`);
}

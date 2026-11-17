import { queryOptions } from "@tanstack/react-query";

import { apiUrl, get, post } from "./client.ts";
import type { Job, JobStatus } from "./jobs.ts";

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
  detail: (id: string) => [...invoiceKeys.all, "detail", id] as const,
};

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

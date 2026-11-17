import type { Invoice, InvoiceChanges, InvoiceInput } from "@/api/invoices.ts";
import { serviceTypes, type ServiceType } from "@/api/jobs.ts";
import {
  basisPointsToPercent,
  centsToDollars,
  dollarsToCents,
  emptyAsNull,
  hoursToMinutes,
  minutesToHours,
  optionalCentsToDollars,
  optionalDollarsToCents,
  percentToBasisPoints,
} from "@/lib/form.ts";
import { invoiceItems } from "@/lib/invoice-labels.ts";
import { hourlyPriceCents } from "@/lib/job-template.ts";

// What the line of an invoice is for: one of the kinds of cleaning, picked
// so that nothing is typed, or something else, written out.
export const itemChoices = [...serviceTypes, "other"] as const;
export type ItemChoice = (typeof itemChoices)[number];

// What a discount counts on the form: nothing, dollars or a percentage.
export const discountKinds = ["none", "amount", "percentage"] as const;
export type DiscountKind = (typeof discountKinds)[number];

// An invoice while it is typed. The item is a choice, and the discount one
// number and what it counts; the item as it prints and cents or basis
// points are what is sent.
export type InvoiceDraft = {
  issueDate: string;
  // Blank is due on receipt.
  dueDate: string;
  item: ItemChoice;
  // What the item is when it is none of the usual ones.
  otherItem: string;
  // Blank prints nothing next to the item.
  description: string;
  discountKind: DiscountKind;
  discount: string;
  discountDescription: string;
  notes: string;
};

// What an invoice copied from its job when it was generated, while it is
// corrected: the day of the visit, and hours and dollars as typed. Only an
// invoice that exists has these as fields.
export type PricingDraft = {
  serviceDate: string;
  hours: string;
  hourlyRate: string;
  // Blank charges by the hour.
  fixedPrice: string;
};

// The names the API gives these fields in its issues. The last four are
// the fields a page adds for an invoice that exists, through `children`.
export const invoiceFieldNames = [
  "issueDate",
  "dueDate",
  "item",
  "description",
  "fixedDiscountCents",
  "discountBasisPoints",
  "discountDescription",
  "notes",
  "serviceDate",
  "durationMinutes",
  "hourlyRateCents",
  "fixedPriceCents",
] as const;

// A new invoice is issued today and due on receipt, for the kind of
// cleaning the job is, with no discount: what the API gives one sent with
// the job alone.
export function newInvoiceDraft(
  serviceType: ServiceType,
  today: string,
): InvoiceDraft {
  return {
    issueDate: today,
    dueDate: "",
    item: serviceType,
    otherItem: "",
    description: "",
    discountKind: "none",
    discount: "",
    discountDescription: "",
    notes: "",
  };
}

// An invoice that exists, as its form starts from it. The item is picked
// again when it reads as one of the usual ones, and written out otherwise.
export function toDraft(invoice: Invoice): InvoiceDraft {
  const usualItem = serviceTypes.find(
    (serviceType) => invoiceItems[serviceType] === invoice.item,
  );
  // An amount or a share of nothing is no discount.
  const amountOff = invoice.fixedDiscountCents ?? 0;
  const shareOff = invoice.discountBasisPoints ?? 0;
  return {
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate ?? "",
    item: usualItem ?? "other",
    otherItem: usualItem === undefined ? invoice.item : "",
    description: invoice.description ?? "",
    discountKind:
      amountOff !== 0 ? "amount" : shareOff !== 0 ? "percentage" : "none",
    discount:
      amountOff !== 0
        ? centsToDollars(amountOff)
        : shareOff !== 0
          ? basisPointsToPercent(shareOff)
          : "",
    discountDescription: invoice.discountDescription ?? "",
    notes: invoice.notes ?? "",
  };
}

export function fromDraft(draft: InvoiceDraft): InvoiceInput {
  return {
    issueDate: draft.issueDate,
    dueDate: draft.dueDate === "" ? null : draft.dueDate,
    item: draft.item === "other" ? draft.otherItem : invoiceItems[draft.item],
    description: emptyAsNull(draft.description),
    // One form of discount at most: the API refuses both.
    fixedDiscountCents:
      draft.discountKind === "amount" ? dollarsToCents(draft.discount) : null,
    discountBasisPoints:
      draft.discountKind === "percentage"
        ? percentToBasisPoints(draft.discount)
        : null,
    // What describes a discount goes with it.
    discountDescription:
      draft.discountKind === "none"
        ? null
        : emptyAsNull(draft.discountDescription),
    notes: emptyAsNull(draft.notes),
  };
}

export function toPricingDraft(invoice: Invoice): PricingDraft {
  return {
    serviceDate: invoice.serviceDate,
    hours: minutesToHours(invoice.durationMinutes),
    hourlyRate: centsToDollars(invoice.hourlyRateCents),
    fixedPrice: optionalCentsToDollars(invoice.fixedPriceCents),
  };
}

export function fromPricingDraft(
  draft: PricingDraft,
): Pick<
  InvoiceChanges,
  "serviceDate" | "durationMinutes" | "hourlyRateCents" | "fixedPriceCents"
> {
  return {
    serviceDate: draft.serviceDate,
    durationMinutes: hoursToMinutes(draft.hours),
    hourlyRateCents: dollarsToCents(draft.hourlyRate),
    fixedPriceCents: optionalDollarsToCents(draft.fixedPrice),
  };
}

// What the invoice charges before the discount and the tax, as the API
// derives it: the agreed price, otherwise the hourly rate x the hours.
// Unknown while what it is computed from is blank.
export function subtotalCents(draft: PricingDraft): number | null {
  return optionalDollarsToCents(draft.fixedPrice) ?? hourlyPriceCents(draft);
}

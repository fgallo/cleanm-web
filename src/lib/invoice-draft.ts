import type { InvoiceInput } from "@/api/invoices.ts";
import { serviceTypes, type ServiceType } from "@/api/jobs.ts";
import {
  dollarsToCents,
  emptyAsNull,
  percentToBasisPoints,
} from "@/lib/form.ts";
import { invoiceItems } from "@/lib/invoice-labels.ts";

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

// The names the API gives these fields in its issues.
export const invoiceFieldNames = [
  "issueDate",
  "dueDate",
  "item",
  "description",
  "fixedDiscountCents",
  "discountBasisPoints",
  "discountDescription",
  "notes",
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

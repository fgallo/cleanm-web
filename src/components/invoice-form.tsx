import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router";

import { describeOutsideFields, issuesFor } from "@/api/client.ts";
import type { InvoiceInput } from "@/api/invoices.ts";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { centsToDollars } from "@/lib/form.ts";
import { formatMoney } from "@/lib/format.ts";
import {
  discountKinds,
  fromDraft,
  invoiceFieldNames,
  itemChoices,
  type DiscountKind,
  type InvoiceDraft,
} from "@/lib/invoice-draft.ts";
import { invoiceItems } from "@/lib/invoice-labels.ts";

const discountKindLabels: Record<DiscountKind, string> = {
  none: "No discount",
  amount: "An amount",
  percentage: "A percentage",
};

// What the owner decides about an invoice: when it is issued and due, what
// it is for, a discount and the notes, for generating one and for editing
// one. The item is picked, not typed, unless it is none of the usual ones,
// and nothing else has to be written. The price is not a field here: a new
// invoice takes the job's, and the page of one that exists adds the fields
// that correct it. Like the other forms, the page owns the request and
// passes what the last attempt failed with.
export default function InvoiceForm({
  initial,
  subtotalCents,
  submitLabel,
  cancelTo,
  pending,
  error,
  onSubmit,
  children,
}: {
  // What the form starts from; what is typed afterwards is its own.
  initial: InvoiceDraft;
  // What the discount is taken off: the price of the job, or what the
  // fields of the page come to, `null` while that cannot be told.
  subtotalCents: number | null;
  submitLabel: string;
  cancelTo: string;
  pending: boolean;
  error: Error | null;
  onSubmit: (input: InvoiceInput) => void;
  // Fields the page puts after the line and before the discount, inside
  // the same form: what the invoice charges. The page keeps their state and
  // adds it to what is submitted.
  children?: ReactNode;
}) {
  const [draft, setDraft] = useState(initial);

  function set<Key extends keyof InvoiceDraft>(
    key: Key,
    value: InvoiceDraft[Key],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(fromDraft(draft));
  }

  const issues = {
    issueDate: issuesFor(error, "issueDate"),
    dueDate: issuesFor(error, "dueDate"),
    item: issuesFor(error, "item"),
    description: issuesFor(error, "description"),
    // One field for both forms of discount: the issue names the one sent.
    discount: [
      ...issuesFor(error, "fixedDiscountCents"),
      ...issuesFor(error, "discountBasisPoints"),
    ],
    discountDescription: issuesFor(error, "discountDescription"),
    notes: issuesFor(error, "notes"),
  };
  const formMessage =
    error === null ? null : describeOutsideFields(error, invoiceFieldNames);
  const subtotal =
    subtotalCents === null
      ? "the subtotal"
      : `the subtotal of ${formatMoney(subtotalCents)}`;

  return (
    <form onSubmit={handleSubmit} className="max-w-md">
      <FieldGroup>
        <div className="grid grid-cols-2 gap-4">
          <Field data-invalid={issues.issueDate.length > 0}>
            <FieldLabel htmlFor="issueDate">Issue date</FieldLabel>
            <Input
              id="issueDate"
              type="date"
              required
              aria-invalid={issues.issueDate.length > 0}
              value={draft.issueDate}
              onChange={(event) => set("issueDate", event.target.value)}
            />
            <FieldError errors={issues.issueDate} />
          </Field>
          <Field data-invalid={issues.dueDate.length > 0}>
            <FieldLabel htmlFor="dueDate">Due date</FieldLabel>
            <Input
              id="dueDate"
              type="date"
              min={draft.issueDate}
              aria-invalid={issues.dueDate.length > 0}
              aria-describedby="dueDate-description"
              value={draft.dueDate}
              onChange={(event) => set("dueDate", event.target.value)}
            />
            <FieldDescription id="dueDate-description">
              Blank is due on receipt.
            </FieldDescription>
            <FieldError errors={issues.dueDate} />
          </Field>
        </div>
        {/* An issue goes under the field that is on screen for the item. */}
        <Field data-invalid={draft.item !== "other" && issues.item.length > 0}>
          <FieldLabel htmlFor="item">Item</FieldLabel>
          <NativeSelect
            id="item"
            className="w-full"
            aria-invalid={draft.item !== "other" && issues.item.length > 0}
            value={draft.item}
            onChange={(event) =>
              set(
                "item",
                itemChoices.find((choice) => choice === event.target.value) ??
                  draft.item,
              )
            }
          >
            {itemChoices.map((choice) => (
              <NativeSelectOption key={choice} value={choice}>
                {choice === "other" ? "Other…" : invoiceItems[choice]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {draft.item !== "other" && <FieldError errors={issues.item} />}
        </Field>
        {draft.item === "other" && (
          <Field data-invalid={issues.item.length > 0}>
            <FieldLabel htmlFor="otherItem">Other item</FieldLabel>
            <Input
              id="otherItem"
              required
              maxLength={500}
              aria-invalid={issues.item.length > 0}
              aria-describedby="otherItem-description"
              value={draft.otherItem}
              onChange={(event) => set("otherItem", event.target.value)}
            />
            <FieldDescription id="otherItem-description">
              What the invoice prints as its item.
            </FieldDescription>
            <FieldError errors={issues.item} />
          </Field>
        )}
        <Field data-invalid={issues.description.length > 0}>
          <FieldLabel htmlFor="description">Description</FieldLabel>
          <Input
            id="description"
            maxLength={500}
            aria-invalid={issues.description.length > 0}
            aria-describedby="description-description"
            value={draft.description}
            onChange={(event) => set("description", event.target.value)}
          />
          <FieldDescription id="description-description">
            Printed next to the item. Blank prints nothing.
          </FieldDescription>
          <FieldError errors={issues.description} />
        </Field>
        {children}
        <Field>
          <FieldLabel htmlFor="discountKind">Discount</FieldLabel>
          <NativeSelect
            id="discountKind"
            className="w-full"
            value={draft.discountKind}
            onChange={(event) =>
              // A number typed as dollars is not kept as a percentage: the
              // value starts again with what it counts.
              setDraft((current) => ({
                ...current,
                discountKind:
                  discountKinds.find((kind) => kind === event.target.value) ??
                  current.discountKind,
                discount: "",
              }))
            }
          >
            {discountKinds.map((kind) => (
              <NativeSelectOption key={kind} value={kind}>
                {discountKindLabels[kind]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        {draft.discountKind !== "none" && (
          <>
            <Field data-invalid={issues.discount.length > 0}>
              <FieldLabel htmlFor="discount">
                {draft.discountKind === "amount"
                  ? "Amount off"
                  : "Percentage off"}
              </FieldLabel>
              <Input
                id="discount"
                type="number"
                inputMode="decimal"
                required
                min="0.01"
                max={
                  draft.discountKind === "percentage"
                    ? "100"
                    : subtotalCents === null
                      ? undefined
                      : centsToDollars(subtotalCents)
                }
                step="0.01"
                aria-invalid={issues.discount.length > 0}
                aria-describedby="discount-description"
                value={draft.discount}
                onChange={(event) => set("discount", event.target.value)}
              />
              <FieldDescription id="discount-description">
                {draft.discountKind === "amount"
                  ? `In dollars, off ${subtotal}, before tax.`
                  : `Of ${subtotal}, before tax.`}
              </FieldDescription>
              <FieldError errors={issues.discount} />
            </Field>
            <Field data-invalid={issues.discountDescription.length > 0}>
              <FieldLabel htmlFor="discountDescription">
                Discount description
              </FieldLabel>
              <Input
                id="discountDescription"
                maxLength={200}
                aria-invalid={issues.discountDescription.length > 0}
                aria-describedby="discountDescription-description"
                value={draft.discountDescription}
                onChange={(event) =>
                  set("discountDescription", event.target.value)
                }
              />
              <FieldDescription id="discountDescription-description">
                Printed next to the discount, such as "Referral for 1 cleaning".
                Blank prints "Discount".
              </FieldDescription>
              <FieldError errors={issues.discountDescription} />
            </Field>
          </>
        )}
        <Field data-invalid={issues.notes.length > 0}>
          <FieldLabel htmlFor="notes">Notes</FieldLabel>
          <Textarea
            id="notes"
            maxLength={2000}
            aria-invalid={issues.notes.length > 0}
            aria-describedby="notes-description"
            value={draft.notes}
            onChange={(event) => set("notes", event.target.value)}
          />
          <FieldDescription id="notes-description">
            Printed on the invoice, under "Notes / Terms".
          </FieldDescription>
          <FieldError errors={issues.notes} />
        </Field>
        {formMessage !== null && <FieldError>{formMessage}</FieldError>}
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {submitLabel}
          </Button>
          <Link to={cancelTo} className={buttonVariants({ variant: "ghost" })}>
            Cancel
          </Link>
        </div>
      </FieldGroup>
    </form>
  );
}

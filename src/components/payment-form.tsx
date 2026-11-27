import { useState, type FormEvent } from "react";

import { describeOutsideFields, issuesFor } from "@/api/client.ts";
import { paymentMethods, type PaymentInput } from "@/api/payments.ts";
import { Button } from "@/components/ui/button";
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
import { paymentMethodLabels } from "@/lib/invoice-labels.ts";
import {
  fromDraft,
  paymentFieldNames,
  type PaymentDraft,
} from "@/lib/payment-draft.ts";

// One payment of an invoice: how much came in, how and when, for recording
// one and for correcting one. It opens in place, on the page of the
// invoice, so "Cancel" is a button that closes it and not a link. Like the
// other forms, whoever shows it owns the request and passes what the last
// attempt failed with.
export default function PaymentForm({
  initial,
  maxCents,
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  // What the form starts from; what is typed afterwards is its own.
  initial: PaymentDraft;
  // The most the amount may be: the API refuses a payment that takes the
  // invoice past its total.
  maxCents: number;
  submitLabel: string;
  pending: boolean;
  error: Error | null;
  onSubmit: (input: PaymentInput) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);

  function set<Key extends keyof PaymentDraft>(
    key: Key,
    value: PaymentDraft[Key],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(fromDraft(draft));
  }

  const issues = {
    amountCents: issuesFor(error, "amountCents"),
    method: issuesFor(error, "method"),
    paidOn: issuesFor(error, "paidOn"),
    notes: issuesFor(error, "notes"),
  };
  const formMessage =
    error === null ? null : describeOutsideFields(error, paymentFieldNames);

  return (
    <form onSubmit={handleSubmit} className="max-w-md">
      <FieldGroup>
        <Field data-invalid={issues.amountCents.length > 0}>
          <FieldLabel htmlFor="paymentAmount">Amount</FieldLabel>
          {/* Where typing starts, if anything is typed: the form opens
              filled in, and Enter here sends it as it is. */}
          <Input
            id="paymentAmount"
            type="number"
            inputMode="decimal"
            required
            autoFocus
            min="0.01"
            max={centsToDollars(maxCents)}
            step="0.01"
            aria-invalid={issues.amountCents.length > 0}
            aria-describedby="paymentAmount-description"
            value={draft.amount}
            onChange={(event) => set("amount", event.target.value)}
          />
          <FieldDescription id="paymentAmount-description">
            In dollars, at most {formatMoney(maxCents)}: the payments of an
            invoice never add up to more than its total.
          </FieldDescription>
          <FieldError errors={issues.amountCents} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field data-invalid={issues.method.length > 0}>
            <FieldLabel htmlFor="paymentMethod">Method</FieldLabel>
            <NativeSelect
              id="paymentMethod"
              className="w-full"
              aria-invalid={issues.method.length > 0}
              value={draft.method}
              onChange={(event) =>
                set(
                  "method",
                  paymentMethods.find(
                    (method) => method === event.target.value,
                  ) ?? draft.method,
                )
              }
            >
              {paymentMethods.map((method) => (
                <NativeSelectOption key={method} value={method}>
                  {paymentMethodLabels[method]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldError errors={issues.method} />
          </Field>
          <Field data-invalid={issues.paidOn.length > 0}>
            <FieldLabel htmlFor="paidOn">Paid on</FieldLabel>
            <Input
              id="paidOn"
              type="date"
              required
              aria-invalid={issues.paidOn.length > 0}
              value={draft.paidOn}
              onChange={(event) => set("paidOn", event.target.value)}
            />
            <FieldError errors={issues.paidOn} />
          </Field>
        </div>
        <Field data-invalid={issues.notes.length > 0}>
          <FieldLabel htmlFor="paymentNotes">Notes</FieldLabel>
          <Textarea
            id="paymentNotes"
            rows={2}
            maxLength={2000}
            aria-invalid={issues.notes.length > 0}
            aria-describedby="paymentNotes-description"
            value={draft.notes}
            onChange={(event) => set("notes", event.target.value)}
          />
          <FieldDescription id="paymentNotes-description">
            Kept with the payment, such as "First half". Not printed on the
            invoice.
          </FieldDescription>
          <FieldError errors={issues.notes} />
        </Field>
        {formMessage !== null && <FieldError>{formMessage}</FieldError>}
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {submitLabel}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}

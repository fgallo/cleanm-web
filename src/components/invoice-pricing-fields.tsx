import { issuesFor } from "@/api/client.ts";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/format.ts";
import type { PricingDraft } from "@/lib/invoice-draft.ts";
import { hourlyPriceCents } from "@/lib/job-template.ts";

// What an invoice copied from its job when it was generated, as fields the
// page of an invoice that exists puts inside the form: the day of the visit
// and what it charges. The page keeps the draft and sends it with the rest.
// Changing them changes the invoice alone, never the job.
export default function InvoicePricingFields({
  draft,
  onChange,
  error,
}: {
  draft: PricingDraft;
  onChange: (draft: PricingDraft) => void;
  // What the last attempt to save failed with.
  error: Error | null;
}) {
  function set(key: keyof PricingDraft, value: string) {
    onChange({ ...draft, [key]: value });
  }

  const hourlyPrice = hourlyPriceCents(draft);
  const issues = {
    serviceDate: issuesFor(error, "serviceDate"),
    durationMinutes: issuesFor(error, "durationMinutes"),
    hourlyRateCents: issuesFor(error, "hourlyRateCents"),
    fixedPriceCents: issuesFor(error, "fixedPriceCents"),
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <Field data-invalid={issues.serviceDate.length > 0}>
          <FieldLabel htmlFor="serviceDate">Service date</FieldLabel>
          <Input
            id="serviceDate"
            type="date"
            required
            aria-invalid={issues.serviceDate.length > 0}
            value={draft.serviceDate}
            onChange={(event) => set("serviceDate", event.target.value)}
          />
          <FieldError errors={issues.serviceDate} />
        </Field>
        <Field data-invalid={issues.durationMinutes.length > 0}>
          <FieldLabel htmlFor="hours">Hours</FieldLabel>
          {/* Any fraction is accepted, as on the form of a job. */}
          <Input
            id="hours"
            type="number"
            inputMode="decimal"
            required
            min="0.01"
            max="24"
            step="any"
            aria-invalid={issues.durationMinutes.length > 0}
            value={draft.hours}
            onChange={(event) => set("hours", event.target.value)}
          />
          <FieldError errors={issues.durationMinutes} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field data-invalid={issues.hourlyRateCents.length > 0}>
          <FieldLabel htmlFor="hourlyRate">Hourly rate</FieldLabel>
          <Input
            id="hourlyRate"
            type="number"
            inputMode="decimal"
            required
            min="0"
            step="0.01"
            aria-invalid={issues.hourlyRateCents.length > 0}
            value={draft.hourlyRate}
            onChange={(event) => set("hourlyRate", event.target.value)}
          />
          <FieldError errors={issues.hourlyRateCents} />
        </Field>
        <Field data-invalid={issues.fixedPriceCents.length > 0}>
          <FieldLabel htmlFor="fixedPrice">Agreed price</FieldLabel>
          <Input
            id="fixedPrice"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            aria-invalid={issues.fixedPriceCents.length > 0}
            aria-describedby="fixedPrice-description"
            value={draft.fixedPrice}
            onChange={(event) => set("fixedPrice", event.target.value)}
          />
          <FieldDescription id="fixedPrice-description">
            {hourlyPrice === null
              ? "Blank charges by the hour."
              : `Blank charges by the hour: ${formatMoney(hourlyPrice)}.`}
          </FieldDescription>
          <FieldError errors={issues.fixedPriceCents} />
        </Field>
      </div>
    </>
  );
}

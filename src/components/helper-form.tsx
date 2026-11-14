import { useState, type FormEvent } from "react";
import { Link } from "react-router";

import { describeOutsideFields, issuesFor } from "@/api/client.ts";
import type { Helper, HelperInput } from "@/api/helpers.ts";
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
import { centsToDollars, dollarsToCents, emptyAsNull } from "@/lib/form.ts";

const fields = ["name", "phone", "hourlyRateCents", "active"] as const;

// The fields of a helper, for adding one (`helper` absent) and for editing
// one. Only an existing helper has a status to change: a new one is active.
// Like the other forms, the page owns the request and passes what the last
// attempt failed with.
export default function HelperForm({
  helper,
  submitLabel,
  cancelTo,
  pending,
  error,
  onSubmit,
}: {
  helper?: Helper;
  submitLabel: string;
  cancelTo: string;
  pending: boolean;
  error: Error | null;
  onSubmit: (input: HelperInput) => void;
}) {
  const [name, setName] = useState(helper?.name ?? "");
  const [phone, setPhone] = useState(helper?.phone ?? "");
  // The helper's usual rate. Typed in dollars, sent in cents; blank while
  // none was agreed.
  const [hourlyRate, setHourlyRate] = useState(
    helper === undefined || helper.hourlyRateCents === null
      ? ""
      : centsToDollars(helper.hourlyRateCents),
  );
  const [active, setActive] = useState(helper?.active ?? true);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({
      name,
      phone: emptyAsNull(phone),
      hourlyRateCents:
        hourlyRate.trim() === "" ? null : dollarsToCents(hourlyRate),
      active,
    });
  }

  const nameIssues = issuesFor(error, "name");
  const phoneIssues = issuesFor(error, "phone");
  const hourlyRateIssues = issuesFor(error, "hourlyRateCents");
  const activeIssues = issuesFor(error, "active");
  const formMessage =
    error === null ? null : describeOutsideFields(error, fields);

  return (
    <form onSubmit={handleSubmit} className="max-w-md">
      <FieldGroup>
        <Field data-invalid={nameIssues.length > 0}>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input
            id="name"
            autoComplete="off"
            required
            maxLength={200}
            aria-invalid={nameIssues.length > 0}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <FieldError errors={nameIssues} />
        </Field>
        <Field data-invalid={phoneIssues.length > 0}>
          <FieldLabel htmlFor="phone">Phone</FieldLabel>
          <Input
            id="phone"
            type="tel"
            autoComplete="off"
            maxLength={50}
            aria-invalid={phoneIssues.length > 0}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
          <FieldError errors={phoneIssues} />
        </Field>
        <Field data-invalid={hourlyRateIssues.length > 0}>
          <FieldLabel htmlFor="hourlyRate">Hourly rate</FieldLabel>
          <Input
            id="hourlyRate"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            aria-invalid={hourlyRateIssues.length > 0}
            aria-describedby="hourlyRate-description"
            value={hourlyRate}
            onChange={(event) => setHourlyRate(event.target.value)}
          />
          <FieldDescription id="hourlyRate-description">
            What the helper is usually paid for an hour of work.
          </FieldDescription>
          <FieldError errors={hourlyRateIssues} />
        </Field>
        {helper !== undefined && (
          <Field data-invalid={activeIssues.length > 0}>
            <FieldLabel htmlFor="active">Status</FieldLabel>
            <NativeSelect
              id="active"
              className="w-full"
              aria-invalid={activeIssues.length > 0}
              aria-describedby="active-description"
              value={active ? "active" : "inactive"}
              onChange={(event) => setActive(event.target.value === "active")}
            >
              <NativeSelectOption value="active">Active</NativeSelectOption>
              <NativeSelectOption value="inactive">Inactive</NativeSelectOption>
            </NativeSelect>
            <FieldDescription id="active-description">
              An inactive helper stays on the jobs they have and is no longer
              offered for others.
            </FieldDescription>
            <FieldError errors={activeIssues} />
          </Field>
        )}
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

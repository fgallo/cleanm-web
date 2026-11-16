import { issuesFor } from "@/api/client.ts";
import type { Helper } from "@/api/helpers.ts";
import { serviceTypes } from "@/api/jobs.ts";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/format.ts";
import { serviceTypeLabels } from "@/lib/job-labels.ts";
import { hourlyPriceCents, type TemplateDraft } from "@/lib/job-template.ts";

// The fields a job and a recurring series share: when in the day, what kind
// of cleaning, who helps and what it costs. The form around them keeps the
// draft and adds what is its own, a day or a rule. Hours and dollars are
// what is typed here.
export default function JobTemplateFields({
  draft,
  onChange,
  helpers,
  assignedHelperId,
  error,
}: {
  draft: TemplateDraft;
  onChange: (draft: TemplateDraft) => void;
  helpers: Helper[];
  // The helper the job or the series already has, if any.
  assignedHelperId: string | null;
  // What the last attempt to save failed with.
  error: Error | null;
}) {
  function set<Key extends keyof TemplateDraft>(
    key: Key,
    value: TemplateDraft[Key],
  ) {
    onChange({ ...draft, [key]: value });
  }

  // Only active helpers can be assigned. The one already assigned stays on
  // offer even when inactive, so the field shows who did the job.
  const offeredHelpers = helpers.filter(
    (helper) => helper.active || helper.id === assignedHelperId,
  );
  const hourlyPrice = hourlyPriceCents(draft);
  // What the helper chosen is paid when there is no rate set here. Unknown
  // while nobody is chosen, or while that helper has no usual rate.
  const usualHelperRateCents =
    helpers.find((helper) => helper.id === draft.helperId)?.hourlyRateCents ??
    null;

  const issues = {
    startTime: issuesFor(error, "startTime"),
    durationMinutes: issuesFor(error, "durationMinutes"),
    serviceType: issuesFor(error, "serviceType"),
    hourlyRateCents: issuesFor(error, "hourlyRateCents"),
    fixedPriceCents: issuesFor(error, "fixedPriceCents"),
    helperId: issuesFor(error, "helperId"),
    helperHourlyRateCents: issuesFor(error, "helperHourlyRateCents"),
    notes: issuesFor(error, "notes"),
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <Field data-invalid={issues.startTime.length > 0}>
          <FieldLabel htmlFor="startTime">Start time</FieldLabel>
          <Input
            id="startTime"
            type="time"
            required
            aria-invalid={issues.startTime.length > 0}
            value={draft.startTime}
            onChange={(event) => set("startTime", event.target.value)}
          />
          <FieldError errors={issues.startTime} />
        </Field>
        <Field data-invalid={issues.durationMinutes.length > 0}>
          <FieldLabel htmlFor="hours">Hours</FieldLabel>
          {/* Any fraction is accepted: a step would refuse a job whose
              duration is not a multiple of it, before anything is sent. */}
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
      <Field data-invalid={issues.serviceType.length > 0}>
        <FieldLabel htmlFor="serviceType">Service</FieldLabel>
        <NativeSelect
          id="serviceType"
          className="w-full"
          aria-invalid={issues.serviceType.length > 0}
          value={draft.serviceType}
          onChange={(event) =>
            // The value is one of the options below; `find` is what tells
            // TypeScript so.
            set(
              "serviceType",
              serviceTypes.find((value) => value === event.target.value) ??
                draft.serviceType,
            )
          }
        >
          {serviceTypes.map((value) => (
            <NativeSelectOption key={value} value={value}>
              {serviceTypeLabels[value]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <FieldError errors={issues.serviceType} />
      </Field>
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
      <div className="grid grid-cols-2 gap-4">
        <Field data-invalid={issues.helperId.length > 0}>
          <FieldLabel htmlFor="helperId">Helper</FieldLabel>
          <NativeSelect
            id="helperId"
            className="w-full"
            aria-invalid={issues.helperId.length > 0}
            value={draft.helperId}
            onChange={(event) => set("helperId", event.target.value)}
          >
            <NativeSelectOption value="">No helper</NativeSelectOption>
            {offeredHelpers.map((helper) => (
              <NativeSelectOption key={helper.id} value={helper.id}>
                {helper.active ? helper.name : `${helper.name} (inactive)`}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldError errors={issues.helperId} />
        </Field>
        <Field data-invalid={issues.helperHourlyRateCents.length > 0}>
          <FieldLabel htmlFor="helperHourlyRate">
            Helper's hourly rate
          </FieldLabel>
          {/* It belongs to the job, so it stays as typed when another
              helper is chosen. */}
          <Input
            id="helperHourlyRate"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            aria-invalid={issues.helperHourlyRateCents.length > 0}
            aria-describedby="helperHourlyRate-description"
            value={draft.helperHourlyRate}
            onChange={(event) => set("helperHourlyRate", event.target.value)}
          />
          <FieldDescription id="helperHourlyRate-description">
            {usualHelperRateCents === null
              ? "Blank pays the helper's usual rate."
              : `Blank pays the helper's usual rate: ${formatMoney(usualHelperRateCents)}.`}
          </FieldDescription>
          <FieldError errors={issues.helperHourlyRateCents} />
        </Field>
      </div>
      <Field data-invalid={issues.notes.length > 0}>
        <FieldLabel htmlFor="notes">Notes about the job</FieldLabel>
        <Textarea
          id="notes"
          maxLength={2000}
          aria-invalid={issues.notes.length > 0}
          value={draft.notes}
          onChange={(event) => set("notes", event.target.value)}
        />
        <FieldError errors={issues.notes} />
      </Field>
    </>
  );
}

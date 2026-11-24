import { issuesFor } from "@/api/client.ts";
import type { Helper } from "@/api/helpers.ts";
import { serviceTypes } from "@/api/jobs.ts";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatDuration, formatMoney } from "@/lib/format.ts";
import {
  ownerLabel,
  peopleLabel,
  serviceTypeLabels,
} from "@/lib/job-labels.ts";
import {
  hourlyPriceCents,
  teamOf,
  type TemplateDraft,
} from "@/lib/job-template.ts";

// The fields a job and a recurring series share: when in the day, what kind
// of cleaning, what it costs and who does it. The form around them keeps the
// draft and adds what is its own, a day or a rule. Hours and dollars are
// what is typed here.
export default function JobTemplateFields({
  draft,
  onChange,
  helpers,
  assignedHelperIds,
  error,
}: {
  draft: TemplateDraft;
  onChange: (draft: TemplateDraft) => void;
  helpers: Helper[];
  // The helpers the job or the series already has.
  assignedHelperIds: string[];
  // What the last attempt to save failed with.
  error: Error | null;
}) {
  function set<Key extends keyof TemplateDraft>(
    key: Key,
    value: TemplateDraft[Key],
  ) {
    onChange({ ...draft, [key]: value });
  }

  // A helper ticked joins at their usual rate; one unticked takes the rate
  // typed for them along, as on the API.
  function assign(helperId: string, assigned: boolean) {
    set(
      "helpers",
      assigned
        ? [...draft.helpers, { helperId, hourlyRate: "" }]
        : draft.helpers.filter((helper) => helper.helperId !== helperId),
    );
  }

  function setRate(helperId: string, hourlyRate: string) {
    set(
      "helpers",
      draft.helpers.map((helper) =>
        helper.helperId === helperId ? { ...helper, hourlyRate } : helper,
      ),
    );
  }

  // Only active helpers can be assigned. Those already assigned stay on
  // offer even when inactive, so the form shows who does the job.
  const offeredHelpers = helpers.filter(
    (helper) => helper.active || assignedHelperIds.includes(helper.id),
  );
  const hourlyPrice = hourlyPriceCents(draft);
  const team = teamOf(draft);

  const issues = {
    startTime: issuesFor(error, "startTime"),
    durationMinutes: issuesFor(error, "durationMinutes"),
    serviceType: issuesFor(error, "serviceType"),
    hourlyRateCents: issuesFor(error, "hourlyRateCents"),
    fixedPriceCents: issuesFor(error, "fixedPriceCents"),
    // About the people as a whole, not about one of the helpers.
    team: [...issuesFor(error, "ownerWorks"), ...issuesFor(error, "helpers")],
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
            aria-describedby="hours-description"
            value={draft.hours}
            onChange={(event) => set("hours", event.target.value)}
          />
          {/* The hours are what is charged; who does the job, below,
              decides how long it takes. */}
          <FieldDescription id="hours-description">
            {team.onSiteMinutes === null
              ? "Hours of cleaning, shared by who does the job."
              : `${peopleLabel(team.people)}: ${formatDuration(team.onSiteMinutes)} at the house.`}
          </FieldDescription>
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
      <FieldSet className="gap-2">
        <FieldLegend variant="label">Who does the job</FieldLegend>
        <label className="flex min-h-8 w-fit items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={draft.ownerWorks}
            onChange={(event) => set("ownerWorks", event.target.checked)}
          />
          {ownerLabel}
        </label>
        {offeredHelpers.map((helper) => {
          // The API names a helper by their place in the list it was sent,
          // which is the order of the draft.
          const place = draft.helpers.findIndex(
            (assigned) => assigned.helperId === helper.id,
          );
          const assigned = draft.helpers[place];
          const helperIssues =
            assigned === undefined
              ? []
              : [
                  ...issuesFor(error, `helpers.${place}.helperId`),
                  ...issuesFor(error, `helpers.${place}.hourlyRateCents`),
                ];
          return (
            <div key={helper.id}>
              <div className="grid min-h-8 grid-cols-[auto_1fr_auto] items-center gap-x-2 text-sm">
                <input
                  id={`helper-${helper.id}`}
                  type="checkbox"
                  className="size-4 accent-primary"
                  aria-invalid={helperIssues.length > 0}
                  checked={assigned !== undefined}
                  onChange={(event) => assign(helper.id, event.target.checked)}
                />
                {/* Where the two do not fit on a line, the usual rate goes
                    under the name in one piece. */}
                <div className="flex flex-wrap gap-x-2">
                  <label
                    htmlFor={`helper-${helper.id}`}
                    className="whitespace-nowrap"
                  >
                    {helper.active ? helper.name : `${helper.name} (inactive)`}
                  </label>
                  {helper.hourlyRateCents !== null && (
                    <span className="whitespace-nowrap text-muted-foreground">
                      usually {formatMoney(helper.hourlyRateCents)} an hour
                    </span>
                  )}
                </div>
                {assigned !== undefined && (
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    className="w-24"
                    aria-label={`Hourly rate of ${helper.name}`}
                    aria-describedby="helpers-description"
                    value={assigned.hourlyRate}
                    onChange={(event) => setRate(helper.id, event.target.value)}
                  />
                )}
              </div>
              <FieldError errors={helperIssues} />
            </div>
          );
        })}
        {draft.helpers.length > 0 && (
          <FieldDescription id="helpers-description">
            A rate next to a helper is what the job pays them for an hour. Blank
            pays their usual rate.
          </FieldDescription>
        )}
        <FieldError errors={issues.team} />
      </FieldSet>
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

import { cn } from "cn";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router";

import { describeOutsideFields, issuesFor } from "@/api/client.ts";
import type { Helper } from "@/api/helpers.ts";
import type { SeriesInput, SeriesRule } from "@/api/recurring-series.ts";
import JobTemplateFields from "@/components/job-template-fields.tsx";
import OptionalDateInput from "@/components/optional-date-input.tsx";
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
import { parseDay } from "@/lib/dates.ts";
import { fromDraft, templateFieldNames, toDraft } from "@/lib/job-template.ts";
import { repeatsLabel } from "@/lib/series-labels.ts";

// The names the API gives these fields in its issues. `propertyId` is the
// field the page adds, through `children`.
const fields = [
  "propertyId",
  "everyWeeks",
  "dayOfMonth",
  "startDate",
  "endDate",
  ...templateFieldNames,
] as const;

// The rhythms on offer: weekly, every two or three weeks, and the two forms
// of monthly the business has (brief, section 3), every four weeks or a day
// of the month. The API takes any number of weeks up to 52.
const weeklyChoices = [1, 2, 3, 4];
const everyMonth = "month";

// A new recurring series: how often, between which days, and the template
// of its jobs, shared with the job form (`JobTemplateFields`). Like the
// other forms, the page owns the request and passes what the last attempt
// failed with.
export default function SeriesForm({
  helpers,
  submitLabel,
  cancelTo,
  pending,
  error,
  onSubmit,
  children,
}: {
  helpers: Helper[];
  submitLabel: string;
  cancelTo: string;
  pending: boolean;
  error: Error | null;
  onSubmit: (input: SeriesInput) => void;
  // Fields the page puts above these, inside the same form: where the
  // visits are. The page keeps their state and adds it to what is submitted.
  children?: ReactNode;
}) {
  // The weeks between two visits, or `everyMonth`. Blank until chosen, like
  // the days: a guess would be saved as easily as a choice.
  const [repeats, setRepeats] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [template, setTemplate] = useState(() => toDraft(null));

  const monthly = repeats === everyMonth;
  const rule: SeriesRule = monthly
    ? { everyWeeks: null, dayOfMonth: Number(dayOfMonth) }
    : { everyWeeks: Number(repeats), dayOfMonth: null };
  // A weekly rule has no weekday of its own: it keeps the one of the day
  // the series starts on, named here once that day is known.
  const weekdayNote =
    monthly || repeats === ""
      ? null
      : parseDay(startDate) === null
        ? "On the weekday of the start date."
        : `${repeatsLabel({ ...rule, startDate })}, the weekday of the start date.`;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({
      ...rule,
      startDate,
      endDate: endDate === "" ? null : endDate,
      ...fromDraft(template),
    });
  }

  const issues = {
    everyWeeks: issuesFor(error, "everyWeeks"),
    dayOfMonth: issuesFor(error, "dayOfMonth"),
    startDate: issuesFor(error, "startDate"),
    endDate: issuesFor(error, "endDate"),
  };
  const formMessage =
    error === null ? null : describeOutsideFields(error, fields);

  return (
    <form onSubmit={handleSubmit} className="max-w-md">
      <FieldGroup>
        {children}
        <div className={cn(monthly && "grid grid-cols-2 gap-4")}>
          <Field data-invalid={issues.everyWeeks.length > 0}>
            <FieldLabel htmlFor="repeats">Repeats</FieldLabel>
            <NativeSelect
              id="repeats"
              className="w-full"
              required
              aria-invalid={issues.everyWeeks.length > 0}
              aria-describedby={
                weekdayNote === null ? undefined : "repeats-description"
              }
              value={repeats}
              onChange={(event) => setRepeats(event.target.value)}
            >
              <NativeSelectOption value="">Choose how often</NativeSelectOption>
              {weeklyChoices.map((weeks) => (
                <NativeSelectOption key={weeks} value={weeks}>
                  {weeks === 1 ? "Every week" : `Every ${weeks} weeks`}
                </NativeSelectOption>
              ))}
              <NativeSelectOption value={everyMonth}>
                Every month
              </NativeSelectOption>
            </NativeSelect>
            {weekdayNote !== null && (
              <FieldDescription id="repeats-description">
                {weekdayNote}
              </FieldDescription>
            )}
            <FieldError errors={issues.everyWeeks} />
          </Field>
          {monthly && (
            <Field data-invalid={issues.dayOfMonth.length > 0}>
              <FieldLabel htmlFor="dayOfMonth">Day of the month</FieldLabel>
              <Input
                id="dayOfMonth"
                type="number"
                inputMode="numeric"
                required
                min="1"
                max="31"
                step="1"
                aria-invalid={issues.dayOfMonth.length > 0}
                aria-describedby="dayOfMonth-description"
                value={dayOfMonth}
                onChange={(event) => setDayOfMonth(event.target.value)}
              />
              <FieldDescription id="dayOfMonth-description">
                Shorter months use their last day.
              </FieldDescription>
              <FieldError errors={issues.dayOfMonth} />
            </Field>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field data-invalid={issues.startDate.length > 0}>
            <FieldLabel htmlFor="startDate">Starts</FieldLabel>
            <Input
              id="startDate"
              type="date"
              required
              aria-invalid={issues.startDate.length > 0}
              aria-describedby="startDate-description"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
            <FieldDescription id="startDate-description">
              {monthly
                ? "Visits begin on that day of the month, from this date on."
                : "The day of the first visit."}
            </FieldDescription>
            <FieldError errors={issues.startDate} />
          </Field>
          <Field data-invalid={issues.endDate.length > 0}>
            <FieldLabel htmlFor="endDate">Ends</FieldLabel>
            <OptionalDateInput
              id="endDate"
              min={startDate === "" ? undefined : startDate}
              aria-invalid={issues.endDate.length > 0}
              aria-describedby="endDate-description"
              value={endDate}
              onValueChange={setEndDate}
              clearLabel="Clear end date"
            />
            <FieldDescription id="endDate-description">
              Blank keeps the series going.
            </FieldDescription>
            <FieldError errors={issues.endDate} />
          </Field>
        </div>
        <JobTemplateFields
          draft={template}
          onChange={setTemplate}
          helpers={helpers}
          assignedHelperId={null}
          error={error}
        />
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

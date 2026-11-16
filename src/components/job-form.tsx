import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router";

import { describeOutsideFields, issuesFor } from "@/api/client.ts";
import type { Helper } from "@/api/helpers.ts";
import {
  jobStatuses,
  serviceTypes,
  toJobInput,
  type Job,
  type JobInput,
} from "@/api/jobs.ts";
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
import {
  centsToDollars,
  dollarsToCents,
  emptyAsNull,
  hoursToMinutes,
  minutesToHours,
} from "@/lib/form.ts";
import { formatMoney } from "@/lib/format.ts";
import { jobStatusLabels, serviceTypeLabels } from "@/lib/job-labels.ts";

// The names the API gives these fields in its issues. `propertyId` is the
// field a page adds for a new job, through `children`.
const fields = [
  "propertyId",
  "status",
  "scheduledDate",
  "startTime",
  "durationMinutes",
  "serviceType",
  "hourlyRateCents",
  "fixedPriceCents",
  "helperId",
  "helperHourlyRateCents",
  "notes",
] as const;

// What can be changed on a job: when it happens, what it is, who helps and
// what it costs, for editing a job and for adding one (`job` absent). Like
// the other forms, the page owns the request and passes what the last
// attempt failed with. Hours and dollars are what is typed; minutes and
// cents are what is sent.
export default function JobForm({
  job,
  defaultDate,
  helpers,
  submitLabel,
  cancelTo,
  pending,
  error,
  onSubmit,
  children,
}: {
  job?: Job;
  // The day (YYYY-MM-DD) a new job is offered on.
  defaultDate?: string;
  helpers: Helper[];
  submitLabel: string;
  cancelTo: string;
  pending: boolean;
  error: Error | null;
  onSubmit: (input: JobInput) => void;
  // Fields the page puts above these, inside the same form: where a new job
  // is. The page keeps their state and adds it to what is submitted.
  children?: ReactNode;
}) {
  // A new job starts scheduled and regular, as most are. Its time, hours
  // and rate start blank: a guess would be saved as easily as a choice.
  const initial = job === undefined ? null : toJobInput(job);
  const [status, setStatus] = useState(initial?.status ?? "scheduled");
  const [scheduledDate, setScheduledDate] = useState(
    initial?.scheduledDate ?? defaultDate ?? "",
  );
  const [startTime, setStartTime] = useState(initial?.startTime ?? "");
  const [hours, setHours] = useState(
    initial === null ? "" : minutesToHours(initial.durationMinutes),
  );
  const [serviceType, setServiceType] = useState(
    initial?.serviceType ?? "regular",
  );
  const [hourlyRate, setHourlyRate] = useState(
    initial === null ? "" : centsToDollars(initial.hourlyRateCents),
  );
  const [fixedPrice, setFixedPrice] = useState(
    initial === null || initial.fixedPriceCents === null
      ? ""
      : centsToDollars(initial.fixedPriceCents),
  );
  // An empty value is "No helper".
  const [helperId, setHelperId] = useState(initial?.helperId ?? "");
  // Blank unless this job pays its helper a rate of its own. It belongs to
  // the job, so it stays as typed when another helper is chosen.
  const [helperHourlyRate, setHelperHourlyRate] = useState(
    initial === null || initial.helperHourlyRateCents === null
      ? ""
      : centsToDollars(initial.helperHourlyRateCents),
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");

  // Only active helpers can be assigned. The one this job already has stays
  // on offer even when inactive, so the field shows who did the job.
  const offeredHelpers = helpers.filter(
    (helper) => helper.active || helper.id === initial?.helperId,
  );
  // The same arithmetic as the API: rate x duration, rounded to the cent.
  // Unknown while either is blank, as on a new job.
  const hourlyPriceCents =
    hours.trim() === "" || hourlyRate.trim() === ""
      ? null
      : Math.round((dollarsToCents(hourlyRate) * hoursToMinutes(hours)) / 60);
  // What the helper chosen is paid when the job has no rate of its own.
  // Unknown while nobody is chosen, or while that helper has no usual rate.
  const usualHelperRateCents =
    helpers.find((helper) => helper.id === helperId)?.hourlyRateCents ?? null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({
      status,
      scheduledDate,
      startTime,
      durationMinutes: hoursToMinutes(hours),
      serviceType,
      hourlyRateCents: dollarsToCents(hourlyRate),
      fixedPriceCents:
        fixedPrice.trim() === "" ? null : dollarsToCents(fixedPrice),
      helperId: helperId === "" ? null : helperId,
      helperHourlyRateCents:
        helperHourlyRate.trim() === ""
          ? null
          : dollarsToCents(helperHourlyRate),
      notes: emptyAsNull(notes),
    });
  }

  const issues = {
    status: issuesFor(error, "status"),
    scheduledDate: issuesFor(error, "scheduledDate"),
    startTime: issuesFor(error, "startTime"),
    durationMinutes: issuesFor(error, "durationMinutes"),
    serviceType: issuesFor(error, "serviceType"),
    hourlyRateCents: issuesFor(error, "hourlyRateCents"),
    fixedPriceCents: issuesFor(error, "fixedPriceCents"),
    helperId: issuesFor(error, "helperId"),
    helperHourlyRateCents: issuesFor(error, "helperHourlyRateCents"),
    notes: issuesFor(error, "notes"),
  };
  const formMessage =
    error === null ? null : describeOutsideFields(error, fields);

  return (
    <form onSubmit={handleSubmit} className="max-w-md">
      <FieldGroup>
        {children}
        <Field data-invalid={issues.status.length > 0}>
          <FieldLabel htmlFor="status">Status</FieldLabel>
          <NativeSelect
            id="status"
            className="w-full"
            aria-invalid={issues.status.length > 0}
            value={status}
            onChange={(event) =>
              // The value is one of the options below; `find` is what tells
              // TypeScript so.
              setStatus(
                jobStatuses.find((value) => value === event.target.value) ??
                  status,
              )
            }
          >
            {jobStatuses.map((value) => (
              <NativeSelectOption key={value} value={value}>
                {jobStatusLabels[value]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldError errors={issues.status} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field data-invalid={issues.scheduledDate.length > 0}>
            <FieldLabel htmlFor="scheduledDate">Date</FieldLabel>
            <Input
              id="scheduledDate"
              type="date"
              required
              aria-invalid={issues.scheduledDate.length > 0}
              value={scheduledDate}
              onChange={(event) => setScheduledDate(event.target.value)}
            />
            <FieldError errors={issues.scheduledDate} />
          </Field>
          <Field data-invalid={issues.startTime.length > 0}>
            <FieldLabel htmlFor="startTime">Start time</FieldLabel>
            <Input
              id="startTime"
              type="time"
              required
              aria-invalid={issues.startTime.length > 0}
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
            />
            <FieldError errors={issues.startTime} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
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
              value={hours}
              onChange={(event) => setHours(event.target.value)}
            />
            <FieldError errors={issues.durationMinutes} />
          </Field>
          <Field data-invalid={issues.serviceType.length > 0}>
            <FieldLabel htmlFor="serviceType">Service</FieldLabel>
            <NativeSelect
              id="serviceType"
              className="w-full"
              aria-invalid={issues.serviceType.length > 0}
              value={serviceType}
              onChange={(event) =>
                setServiceType(
                  serviceTypes.find((value) => value === event.target.value) ??
                    serviceType,
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
              value={hourlyRate}
              onChange={(event) => setHourlyRate(event.target.value)}
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
              value={fixedPrice}
              onChange={(event) => setFixedPrice(event.target.value)}
            />
            <FieldDescription id="fixedPrice-description">
              {hourlyPriceCents === null
                ? "Blank charges by the hour."
                : `Blank charges by the hour: ${formatMoney(hourlyPriceCents)}.`}
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
              value={helperId}
              onChange={(event) => setHelperId(event.target.value)}
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
            <Input
              id="helperHourlyRate"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              aria-invalid={issues.helperHourlyRateCents.length > 0}
              aria-describedby="helperHourlyRate-description"
              value={helperHourlyRate}
              onChange={(event) => setHelperHourlyRate(event.target.value)}
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
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
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

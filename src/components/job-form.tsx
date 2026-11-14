import { useState, type FormEvent } from "react";
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

// The names the API gives these fields in its issues.
const fields = [
  "status",
  "scheduledDate",
  "startTime",
  "durationMinutes",
  "serviceType",
  "hourlyRateCents",
  "fixedPriceCents",
  "helperId",
  "notes",
] as const;

// What can be changed on a job: when it happens, what it is, who helps and
// what it costs. Like the other forms, the page owns the request and passes
// what the last attempt failed with. Hours and dollars are what is typed;
// minutes and cents are what is sent.
export default function JobForm({
  job,
  helpers,
  submitLabel,
  cancelTo,
  pending,
  error,
  onSubmit,
}: {
  job: Job;
  helpers: Helper[];
  submitLabel: string;
  cancelTo: string;
  pending: boolean;
  error: Error | null;
  onSubmit: (input: JobInput) => void;
}) {
  const initial = toJobInput(job);
  const [status, setStatus] = useState(initial.status);
  const [scheduledDate, setScheduledDate] = useState(initial.scheduledDate);
  const [startTime, setStartTime] = useState(initial.startTime);
  const [hours, setHours] = useState(minutesToHours(initial.durationMinutes));
  const [serviceType, setServiceType] = useState(initial.serviceType);
  const [hourlyRate, setHourlyRate] = useState(
    centsToDollars(initial.hourlyRateCents),
  );
  const [fixedPrice, setFixedPrice] = useState(
    initial.fixedPriceCents === null
      ? ""
      : centsToDollars(initial.fixedPriceCents),
  );
  // An empty value is "No helper".
  const [helperId, setHelperId] = useState(initial.helperId ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");

  // Only active helpers can be assigned. The one this job already has stays
  // on offer even when inactive, so the field shows who did the job.
  const offeredHelpers = helpers.filter(
    (helper) => helper.active || helper.id === initial.helperId,
  );
  // The same arithmetic as the API: rate x duration, rounded to the cent.
  const hourlyPriceCents = Math.round(
    (dollarsToCents(hourlyRate) * hoursToMinutes(hours)) / 60,
  );

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
    notes: issuesFor(error, "notes"),
  };
  const formMessage =
    error === null ? null : describeOutsideFields(error, fields);

  return (
    <form onSubmit={handleSubmit} className="max-w-md">
      <FieldGroup>
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
              Blank charges by the hour: {formatMoney(hourlyPriceCents)}.
            </FieldDescription>
            <FieldError errors={issues.fixedPriceCents} />
          </Field>
        </div>
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

import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router";

import { describeOutsideFields, issuesFor } from "@/api/client.ts";
import type { Helper } from "@/api/helpers.ts";
import {
  jobStatuses,
  toJobInput,
  type Job,
  type JobInput,
} from "@/api/jobs.ts";
import JobTemplateFields from "@/components/job-template-fields.tsx";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { jobStatusLabels } from "@/lib/job-labels.ts";
import { fromDraft, templateFieldNames, toDraft } from "@/lib/job-template.ts";

// The names the API gives these fields in its issues. `propertyId` is the
// field a page adds for a new job, through `children`.
const fields = [
  "propertyId",
  "status",
  "scheduledDate",
  ...templateFieldNames,
] as const;

// What can be changed on a job: its status and its day, and the template it
// shares with a recurring series (`JobTemplateFields`), for editing a job
// and for adding one (`job` absent). Like the other forms, the page owns
// the request and passes what the last attempt failed with.
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
  // A new job starts scheduled, as most are.
  const initial = job === undefined ? null : toJobInput(job);
  const [status, setStatus] = useState(initial?.status ?? "scheduled");
  const [scheduledDate, setScheduledDate] = useState(
    initial?.scheduledDate ?? defaultDate ?? "",
  );
  const [template, setTemplate] = useState(() => toDraft(initial));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({ status, scheduledDate, ...fromDraft(template) });
  }

  const statusIssues = issuesFor(error, "status");
  const scheduledDateIssues = issuesFor(error, "scheduledDate");
  const formMessage =
    error === null ? null : describeOutsideFields(error, fields);

  return (
    <form onSubmit={handleSubmit} className="max-w-md">
      <FieldGroup>
        {children}
        <div className="grid grid-cols-2 gap-4">
          <Field data-invalid={statusIssues.length > 0}>
            <FieldLabel htmlFor="status">Status</FieldLabel>
            <NativeSelect
              id="status"
              className="w-full"
              aria-invalid={statusIssues.length > 0}
              value={status}
              onChange={(event) =>
                // The value is one of the options below; `find` is what
                // tells TypeScript so.
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
            <FieldError errors={statusIssues} />
          </Field>
          <Field data-invalid={scheduledDateIssues.length > 0}>
            <FieldLabel htmlFor="scheduledDate">Date</FieldLabel>
            <Input
              id="scheduledDate"
              type="date"
              required
              aria-invalid={scheduledDateIssues.length > 0}
              value={scheduledDate}
              onChange={(event) => setScheduledDate(event.target.value)}
            />
            <FieldError errors={scheduledDateIssues} />
          </Field>
        </div>
        <JobTemplateFields
          draft={template}
          onChange={setTemplate}
          helpers={helpers}
          assignedHelperId={initial?.helperId ?? null}
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

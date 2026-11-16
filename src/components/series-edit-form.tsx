import { useState, type FormEvent } from "react";
import { Link } from "react-router";

import { describeOutsideFields, issuesFor } from "@/api/client.ts";
import type { Helper } from "@/api/helpers.ts";
import {
  toSeriesChanges,
  type RecurringSeries,
  type SeriesChanges,
} from "@/api/recurring-series.ts";
import JobTemplateFields from "@/components/job-template-fields.tsx";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { fromDraft, templateFieldNames, toDraft } from "@/lib/job-template.ts";

// The names the API gives these fields in its issues.
const fields = ["endDate", ...templateFieldNames] as const;

// What can change on a series that exists: when it ends and the template of
// its jobs. The rule, the first day and the property are not fields here:
// the API keeps them, and the page says what they are. Like the other
// forms, the page owns the request and passes what the last attempt failed
// with.
export default function SeriesEditForm({
  series,
  helpers,
  cancelTo,
  pending,
  error,
  onSubmit,
}: {
  series: RecurringSeries;
  helpers: Helper[];
  cancelTo: string;
  pending: boolean;
  error: Error | null;
  onSubmit: (input: SeriesChanges) => void;
}) {
  const initial = toSeriesChanges(series);
  const [endDate, setEndDate] = useState(initial.endDate ?? "");
  const [template, setTemplate] = useState(() => toDraft(initial));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({
      endDate: endDate === "" ? null : endDate,
      ...fromDraft(template),
    });
  }

  const endDateIssues = issuesFor(error, "endDate");
  const formMessage =
    error === null ? null : describeOutsideFields(error, fields);

  return (
    <form onSubmit={handleSubmit} className="max-w-md">
      <FieldGroup>
        <Field data-invalid={endDateIssues.length > 0}>
          <FieldLabel htmlFor="endDate">Ends</FieldLabel>
          <Input
            id="endDate"
            type="date"
            min={series.startDate}
            aria-invalid={endDateIssues.length > 0}
            aria-describedby="endDate-description"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
          <FieldDescription id="endDate-description">
            The last day a visit can fall on: the visits after it are removed.
            Blank keeps the series going.
          </FieldDescription>
          <FieldError errors={endDateIssues} />
        </Field>
        <JobTemplateFields
          draft={template}
          onChange={setTemplate}
          helpers={helpers}
          assignedHelperId={initial.helperId}
          error={error}
        />
        {formMessage !== null && <FieldError>{formMessage}</FieldError>}
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            Save changes
          </Button>
          <Link to={cancelTo} className={buttonVariants({ variant: "ghost" })}>
            Cancel
          </Link>
        </div>
      </FieldGroup>
    </form>
  );
}

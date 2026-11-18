import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";
import { Temporal } from "temporal-polyfill";

import { isNotFound } from "@/api/client.ts";
import {
  canBeInvoiced,
  createInvoice,
  invoiceKeys,
  type InvoiceInput,
} from "@/api/invoices.ts";
import { jobKeys, jobQueryOptions, type Job } from "@/api/jobs.ts";
import { useSession } from "@/auth/session-context.ts";
import InvoiceForm from "@/components/invoice-form.tsx";
import RequestFailed from "@/components/request-failed.tsx";
import { formatDay, formatHours, formatMoney } from "@/lib/format.ts";
import { newInvoiceDraft } from "@/lib/invoice-draft.ts";
import { jobStatusLabels } from "@/lib/job-labels.ts";

// The invoice of one job, before it exists: generating it takes a number
// that is never given again, so it is asked for on a page, with what the
// owner may want to set first, and not with one click.
export default function InvoiceNewPage() {
  const { jobId } = useParams();
  if (jobId === undefined) {
    throw new Error("InvoiceNewPage is rendered without a :jobId parameter");
  }
  return <InvoiceNew jobId={jobId} />;
}

function InvoiceNew({ jobId }: { jobId: string }) {
  const job = useQuery(jobQueryOptions(jobId));

  return (
    <>
      <h1 className="mb-4 font-heading text-xl font-semibold">New invoice</h1>
      {job.isPending && <p className="text-muted-foreground">Loading…</p>}
      {job.isError &&
        (isNotFound(job.error) ? (
          <>
            <p role="alert">Job not found.</p>
            <p className="mt-4 text-sm">
              <Link
                to="/calendar"
                className="text-muted-foreground hover:text-foreground"
              >
                Back to calendar
              </Link>
            </p>
          </>
        ) : (
          <RequestFailed error={job.error} onRetry={() => void job.refetch()} />
        ))}
      {job.isSuccess &&
        (canBeInvoiced(job.data) ? (
          <NewForm job={job.data} />
        ) : (
          <NotInvoiced job={job.data} />
        ))}
    </>
  );
}

// Why the job gets no invoice here: it has one, or it is not a visit yet,
// or no longer one.
function NotInvoiced({ job }: { job: Job }) {
  return (
    <>
      {job.invoice !== null ? (
        <p>
          This job already has an invoice:{" "}
          <Link
            to={`/invoices/${job.invoice.id}`}
            className="underline hover:text-muted-foreground"
          >
            #{job.invoice.number}
          </Link>
          .
        </p>
      ) : (
        <p role="alert">
          A job that is {jobStatusLabels[job.status].toLowerCase()} cannot be
          invoiced, only one that is scheduled or completed.
        </p>
      )}
      <p className="mt-4 text-sm">
        <Link
          to={`/calendar/${job.scheduledDate}`}
          className="text-muted-foreground hover:text-foreground"
        >
          Back to the day of the job
        </Link>
      </p>
    </>
  );
}

function NewForm({ job }: { job: Job }) {
  const { organization } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: (input: InvoiceInput) =>
      createInvoice({ ...input, jobId: job.id }),
    onSuccess: (invoice) => {
      // Its page starts from the answer.
      queryClient.setQueryData(invoiceKeys.detail(invoice.id), invoice);
      // The job has an invoice now, on every list and on its own, and the
      // month it was issued in has one more.
      void queryClient.invalidateQueries({ queryKey: jobKeys.all });
      void queryClient.invalidateQueries({ queryKey: invoiceKeys.ranges() });
      void navigate(`/invoices/${invoice.id}`);
    },
  });

  return (
    <>
      <div className="mb-4 max-w-md text-sm text-muted-foreground">
        <p>
          {job.client.name} · {job.property.addressLine1}
        </p>
        <p className="mt-1">
          {formatDay(Temporal.PlainDate.from(job.scheduledDate))} ·{" "}
          {formatMoney(job.priceCents)}{" "}
          {job.fixedPriceCents === null
            ? `for ${formatHours(job.durationMinutes)} at ${formatMoney(job.hourlyRateCents)} an hour`
            : "agreed price"}
        </p>
        <p className="mt-1">
          The invoice copies the price, who it bills and the tax as they are
          now, and takes the next invoice number, which is never used again.
        </p>
      </div>
      <InvoiceForm
        // Issued today, which is a day where the organization is, not
        // where the browser is.
        initial={newInvoiceDraft(
          job.serviceType,
          Temporal.Now.plainDateISO(organization.timezone).toString(),
        )}
        subtotalCents={job.priceCents}
        submitLabel="Generate invoice"
        cancelTo={`/calendar/${job.scheduledDate}`}
        pending={create.isPending}
        error={create.error}
        onSubmit={create.mutate}
      />
    </>
  );
}

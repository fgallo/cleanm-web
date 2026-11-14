import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";

import { isNotFound } from "@/api/client.ts";
import { helperListQueryOptions, type Helper } from "@/api/helpers.ts";
import {
  jobKeys,
  jobQueryOptions,
  updateJob,
  type Job,
  type JobInput,
} from "@/api/jobs.ts";
import JobForm from "@/components/job-form.tsx";
import RequestFailed from "@/components/request-failed.tsx";

export default function JobEditPage() {
  const { jobId } = useParams();
  if (jobId === undefined) {
    throw new Error("JobEditPage is rendered without a :jobId parameter");
  }
  return <JobEdit jobId={jobId} />;
}

function JobEdit({ jobId }: { jobId: string }) {
  const job = useQuery(jobQueryOptions(jobId));
  // The helpers the job can be given to.
  const helpers = useQuery(helperListQueryOptions);

  return (
    <>
      <h1 className="mb-4 font-heading text-xl font-semibold">Edit job</h1>
      {(job.isPending || (job.isSuccess && helpers.isPending)) && (
        <p className="text-muted-foreground">Loading…</p>
      )}
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
      {job.isSuccess && helpers.isError && (
        <RequestFailed
          error={helpers.error}
          onRetry={() => void helpers.refetch()}
        />
      )}
      {/* Mounted once both are known: the form copies the job into its
          state, and a background refetch must not overwrite what is typed. */}
      {job.isSuccess && helpers.isSuccess && (
        <EditForm job={job.data} helpers={helpers.data} />
      )}
    </>
  );
}

function EditForm({ job, helpers }: { job: Job; helpers: Helper[] }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const update = useMutation({
    mutationFn: (input: JobInput) => updateJob(job, input),
    onSuccess: async (updated) => {
      queryClient.setQueryData(jobKeys.detail(updated.id), updated);
      // The calendar and the days that list this job, the one it left
      // included when its date changed.
      await queryClient.invalidateQueries({ queryKey: jobKeys.ranges() });
      void navigate(`/calendar/${updated.scheduledDate}`);
    },
  });

  return (
    <>
      <div className="mb-4 max-w-md text-sm text-muted-foreground">
        <p>
          {job.client.name} · {job.property.addressLine1}
        </p>
        {job.recurringSeriesId !== null && (
          <p className="mt-1">
            Part of a recurring series: what changes here changes this visit
            only.
          </p>
        )}
        {job.invoice !== null && (
          <p className="mt-1">
            Invoice #{job.invoice.number} keeps the price it was generated with.
          </p>
        )}
      </div>
      <JobForm
        job={job}
        helpers={helpers}
        submitLabel="Save changes"
        cancelTo={`/calendar/${job.scheduledDate}`}
        pending={update.isPending}
        error={update.error}
        onSubmit={update.mutate}
      />
    </>
  );
}

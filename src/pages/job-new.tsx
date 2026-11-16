import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router";
import { Temporal } from "temporal-polyfill";

import { clientListQueryOptions, type Client } from "@/api/clients.ts";
import { helperListQueryOptions, type Helper } from "@/api/helpers.ts";
import { createJob, jobKeys, type JobInput } from "@/api/jobs.ts";
import { useSession } from "@/auth/session-context.ts";
import JobForm from "@/components/job-form.tsx";
import PropertyChoiceFields from "@/components/property-choice-fields.tsx";
import RequestFailed from "@/components/request-failed.tsx";
import { parseDay } from "@/lib/dates.ts";
import { usePropertyChoice } from "@/lib/use-property-choice.ts";

// A one-off job: a visit on one day, with no series behind it.
export default function JobNewPage() {
  const { organization } = useSession();
  const [searchParams] = useSearchParams();
  // `?date=` is the day whose page asked for the job. Without it the job
  // is offered for today, which is a day where the organization is, not
  // where the browser is.
  const asked = parseDay(searchParams.get("date") ?? "");
  const defaultDate = (
    asked ?? Temporal.Now.plainDateISO(organization.timezone)
  ).toString();
  const cancelTo =
    asked === null ? "/calendar" : `/calendar/${asked.toString()}`;

  // Who the job can be for, and who can be sent to help.
  const clients = useQuery(clientListQueryOptions);
  const helpers = useQuery(helperListQueryOptions);

  return (
    <>
      <h1 className="mb-4 font-heading text-xl font-semibold">New job</h1>
      {clients.isError ? (
        <RequestFailed
          error={clients.error}
          onRetry={() => void clients.refetch()}
        />
      ) : helpers.isError ? (
        <RequestFailed
          error={helpers.error}
          onRetry={() => void helpers.refetch()}
        />
      ) : clients.isPending || helpers.isPending ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <NewForm
          defaultDate={defaultDate}
          cancelTo={cancelTo}
          clients={clients.data}
          helpers={helpers.data}
        />
      )}
    </>
  );
}

function NewForm({
  defaultDate,
  cancelTo,
  clients,
  helpers,
}: {
  defaultDate: string;
  cancelTo: string;
  clients: Client[];
  helpers: Helper[];
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // A job is at a property, and a property is found through its client.
  const choice = usePropertyChoice();

  const create = useMutation({
    mutationFn: (input: JobInput) =>
      createJob({ ...input, propertyId: choice.propertyId }),
    onSuccess: async (job) => {
      queryClient.setQueryData(jobKeys.detail(job.id), job);
      await queryClient.invalidateQueries({ queryKey: jobKeys.ranges() });
      void navigate(`/calendar/${job.scheduledDate}`);
    },
  });

  return (
    <JobForm
      defaultDate={defaultDate}
      helpers={helpers}
      submitLabel="Add job"
      cancelTo={cancelTo}
      pending={create.isPending}
      error={create.error}
      onSubmit={create.mutate}
    >
      <PropertyChoiceFields
        clients={clients}
        choice={choice}
        error={create.error}
      />
    </JobForm>
  );
}

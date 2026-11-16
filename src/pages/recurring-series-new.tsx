import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";

import { clientListQueryOptions, type Client } from "@/api/clients.ts";
import { helperListQueryOptions, type Helper } from "@/api/helpers.ts";
import { jobKeys } from "@/api/jobs.ts";
import {
  createSeries,
  seriesKeys,
  type SeriesInput,
} from "@/api/recurring-series.ts";
import PropertyChoiceFields from "@/components/property-choice-fields.tsx";
import RequestFailed from "@/components/request-failed.tsx";
import SeriesForm from "@/components/series-form.tsx";
import { usePropertyChoice } from "@/lib/use-property-choice.ts";

// The visits of a recurring client: a rule and the template of its jobs,
// which the API then generates ahead of time.
export default function RecurringSeriesNewPage() {
  // Who the series can be for, and who can be sent to help.
  const clients = useQuery(clientListQueryOptions);
  const helpers = useQuery(helperListQueryOptions);

  return (
    <>
      <h1 className="mb-4 font-heading text-xl font-semibold">New series</h1>
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
        <NewForm clients={clients.data} helpers={helpers.data} />
      )}
    </>
  );
}

function NewForm({
  clients,
  helpers,
}: {
  clients: Client[];
  helpers: Helper[];
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // A series is at a property, and a property is found through its client.
  const choice = usePropertyChoice();

  const create = useMutation({
    mutationFn: (input: SeriesInput) =>
      createSeries({ ...input, propertyId: choice.propertyId }),
    onSuccess: async () => {
      // The list of series, and the calendar and the days its first visits
      // were just generated on.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: seriesKeys.all }),
        queryClient.invalidateQueries({ queryKey: jobKeys.ranges() }),
      ]);
      void navigate("/recurring-series");
    },
  });

  return (
    <SeriesForm
      helpers={helpers}
      submitLabel="Add series"
      cancelTo="/recurring-series"
      pending={create.isPending}
      error={create.error}
      onSubmit={create.mutate}
    >
      <PropertyChoiceFields
        clients={clients}
        choice={choice}
        error={create.error}
      />
    </SeriesForm>
  );
}

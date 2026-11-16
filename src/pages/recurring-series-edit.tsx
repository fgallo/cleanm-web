import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Temporal } from "temporal-polyfill";

import { describeFailure, isNotFound } from "@/api/client.ts";
import { helperListQueryOptions, type Helper } from "@/api/helpers.ts";
import { jobKeys } from "@/api/jobs.ts";
import {
  deleteSeries,
  seriesKeys,
  seriesQueryOptions,
  updateSeries,
  type RecurringSeries,
  type SeriesChanges,
} from "@/api/recurring-series.ts";
import RequestFailed from "@/components/request-failed.tsx";
import SeriesEditForm from "@/components/series-edit-form.tsx";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format.ts";
import { repeatsLabel } from "@/lib/series-labels.ts";

const listPath = "/recurring-series";

export default function RecurringSeriesEditPage() {
  const { seriesId } = useParams();
  if (seriesId === undefined) {
    throw new Error(
      "RecurringSeriesEditPage is rendered without a :seriesId parameter",
    );
  }
  return <SeriesEdit seriesId={seriesId} />;
}

function SeriesEdit({ seriesId }: { seriesId: string }) {
  const series = useQuery(seriesQueryOptions(seriesId));
  // The helpers the visits can be given to.
  const helpers = useQuery(helperListQueryOptions);

  return (
    <>
      <h1 className="mb-4 font-heading text-xl font-semibold">Edit series</h1>
      {(series.isPending || (series.isSuccess && helpers.isPending)) && (
        <p className="text-muted-foreground">Loading…</p>
      )}
      {series.isError &&
        (isNotFound(series.error) ? (
          <>
            <p role="alert">Series not found.</p>
            <p className="mt-4 text-sm">
              <Link
                to={listPath}
                className="text-muted-foreground hover:text-foreground"
              >
                Back to recurring series
              </Link>
            </p>
          </>
        ) : (
          <RequestFailed
            error={series.error}
            onRetry={() => void series.refetch()}
          />
        ))}
      {series.isSuccess && helpers.isError && (
        <RequestFailed
          error={helpers.error}
          onRetry={() => void helpers.refetch()}
        />
      )}
      {/* Mounted once both are known: the form copies the series into its
          state, and a background refetch must not overwrite what is typed. */}
      {series.isSuccess && helpers.isSuccess && (
        <EditForm series={series.data} helpers={helpers.data} />
      )}
    </>
  );
}

function EditForm({
  series,
  helpers,
}: {
  series: RecurringSeries;
  helpers: Helper[];
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // The visits of the series changed with it, on the API's side. The lists
  // of jobs are asked for again; a job fetched on its own is dropped, since
  // its form would start from what the job was.
  async function forgetItsJobs() {
    queryClient.removeQueries({ queryKey: jobKeys.details() });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: seriesKeys.list() }),
      queryClient.invalidateQueries({ queryKey: jobKeys.ranges() }),
    ]);
  }

  const update = useMutation({
    mutationFn: (input: SeriesChanges) => updateSeries(series, input),
    onSuccess: async (updated) => {
      queryClient.setQueryData(seriesKeys.detail(updated.id), updated);
      await forgetItsJobs();
      void navigate(listPath);
    },
  });

  // Asked twice: the series and its visits cannot be brought back.
  const [confirming, setConfirming] = useState(false);
  const remove = useMutation({
    mutationFn: () => deleteSeries(series.id),
    onSuccess: async () => {
      await forgetItsJobs();
      void navigate(listPath);
    },
  });

  return (
    <>
      <div className="mb-4 max-w-md text-sm text-muted-foreground">
        <p>
          {series.client.name} · {series.property.addressLine1}
        </p>
        <p className="mt-1">
          {repeatsLabel(series)}, from{" "}
          {formatDate(Temporal.PlainDate.from(series.startDate))}. To change how
          often it repeats, end this series and add another.
        </p>
        <p className="mt-1">
          What changes here also changes the upcoming visits, except what was
          edited on a visit itself.
        </p>
      </div>
      <SeriesEditForm
        series={series}
        helpers={helpers}
        cancelTo={listPath}
        pending={update.isPending}
        error={update.error}
        onSubmit={update.mutate}
      />
      <section className="mt-8 max-w-md border-t pt-4">
        <h2 className="font-heading text-base font-medium">Delete series</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Removes the series and all its visits. Only while none of them was
          completed, cancelled or invoiced: after that, end the series instead.
        </p>
        <div className="mt-3 flex items-center gap-2">
          {confirming ? (
            <>
              <span className="text-sm">Delete it and its visits?</span>
              <Button
                variant="destructive"
                size="sm"
                disabled={remove.isPending}
                onClick={() => remove.mutate()}
              >
                Yes, delete
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setConfirming(false);
                  // What a refused attempt said goes with it.
                  remove.reset();
                }}
              >
                Keep it
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirming(true)}
            >
              Delete series
            </Button>
          )}
        </div>
        {remove.isError && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {describeFailure(remove.error)}
          </p>
        )}
      </section>
    </>
  );
}

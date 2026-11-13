import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { jobsQueryOptions, type DateRange } from "@/api/jobs.ts";
import JobCalendar from "@/components/job-calendar.tsx";
import RequestFailed from "@/components/request-failed.tsx";

export default function CalendarPage() {
  // Unknown until the calendar has rendered and said which days it shows.
  const [range, setRange] = useState<DateRange | null>(null);
  const jobs = useQuery({
    ...jobsQueryOptions(range ?? { from: "", to: "" }),
    enabled: range !== null,
    // While another month loads, the jobs of the previous one stay on
    // screen instead of the calendar going empty.
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="font-heading text-xl font-semibold">Calendar</h1>
        {jobs.isFetching && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
      </div>
      {jobs.isError && (
        <div className="mb-4">
          <RequestFailed
            error={jobs.error}
            onRetry={() => void jobs.refetch()}
          />
        </div>
      )}
      <JobCalendar
        jobs={jobs.data ?? []}
        onRangeChange={(next) =>
          // The calendar reports its dates on every render of a view; the
          // same days must not become a new state.
          setRange((current) =>
            current?.from === next.from && current.to === next.to
              ? current
              : next,
          )
        }
      />
    </>
  );
}

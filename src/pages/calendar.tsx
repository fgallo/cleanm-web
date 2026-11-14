import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { jobsQueryOptions, type DateRange } from "@/api/jobs.ts";
import JobCalendar from "@/components/job-calendar.tsx";
import RequestFailed from "@/components/request-failed.tsx";
import { buttonVariants } from "@/components/ui/button";
import { parseDay } from "@/lib/dates.ts";

export default function CalendarPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // `?date=` is how the page of a day sends its reader back to the month
  // that day is in. Anything that is not a day opens the calendar on today.
  const initialDate = parseDay(searchParams.get("date") ?? "")?.toString();

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
        <div className="flex items-center gap-4">
          {jobs.isFetching && (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
          {/* For today; a day's own page offers the job on that day. */}
          <Link to="/jobs/new" className={cn(buttonVariants({ size: "sm" }))}>
            New job
          </Link>
        </div>
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
        initialDate={initialDate}
        onRangeChange={(next) =>
          // The calendar reports its dates on every render of a view; the
          // same days must not become a new state.
          setRange((current) =>
            current?.from === next.from && current.to === next.to
              ? current
              : next,
          )
        }
        // A job opens the list of its day, where its details are.
        onJobClick={(job) => void navigate(`/calendar/${job.scheduledDate}`)}
        onDayClick={(date) => void navigate(`/calendar/${date}`)}
      />
    </>
  );
}

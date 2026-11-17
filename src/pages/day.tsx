import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router";
import { Temporal } from "temporal-polyfill";

import { canBeInvoiced } from "@/api/invoices.ts";
import { jobsQueryOptions, type Job, type JobStatus } from "@/api/jobs.ts";
import RequestFailed from "@/components/request-failed.tsx";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cityLine } from "@/lib/address.ts";
import { parseDay } from "@/lib/dates.ts";
import {
  formatDay,
  formatHours,
  formatMoney,
  formatTime,
} from "@/lib/format.ts";
import { jobStatusLabels, serviceTypeLabels } from "@/lib/job-labels.ts";

// The jobs of one day, each with what the visit needs: where it is, what
// kind of cleaning, who helps and what it costs.
export default function DayPage() {
  const { date } = useParams();
  if (date === undefined) {
    throw new Error("DayPage is rendered without a :date parameter");
  }
  const day = parseDay(date);
  if (day === null) {
    return (
      <>
        <p role="alert">Day not found.</p>
        <p className="mt-4 text-sm">
          <Link
            to="/calendar"
            className="text-muted-foreground hover:text-foreground"
          >
            Back to calendar
          </Link>
        </p>
      </>
    );
  }
  return <DayJobs day={day} />;
}

// `cn` settles the classes the variant and the size override in the
// button's base, such as the border color; the Button component does the
// same before it renders.
const dayLinkClass = cn(buttonVariants({ variant: "outline", size: "sm" }));

function DayJobs({ day }: { day: Temporal.PlainDate }) {
  const date = day.toString();
  // One day is a range that starts and ends on it: both ends are inclusive.
  const jobs = useQuery(jobsQueryOptions({ from: date, to: date }));

  return (
    <>
      <p className="mb-4 text-sm">
        {/* The calendar opens on the month of this day, not on today. */}
        <Link
          to={`/calendar?date=${date}`}
          className="text-muted-foreground hover:text-foreground"
        >
          Back to calendar
        </Link>
      </p>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-xl font-semibold">{formatDay(day)}</h1>
        <div className="flex gap-2">
          <Link
            to={`/jobs/new?date=${date}`}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            New job
          </Link>
          <Link
            to={`/calendar/${day.subtract({ days: 1 }).toString()}`}
            className={dayLinkClass}
          >
            Previous day
          </Link>
          <Link
            to={`/calendar/${day.add({ days: 1 }).toString()}`}
            className={dayLinkClass}
          >
            Next day
          </Link>
        </div>
      </div>
      {jobs.isPending && <p className="text-muted-foreground">Loading…</p>}
      {jobs.isError && (
        <RequestFailed error={jobs.error} onRetry={() => void jobs.refetch()} />
      )}
      {jobs.isSuccess &&
        (jobs.data.length === 0 ? (
          <p className="text-muted-foreground">No jobs on this day.</p>
        ) : (
          <ul className="grid max-w-2xl gap-3">
            {jobs.data.map((job) => (
              <li key={job.id}>
                <JobCard job={job} />
              </li>
            ))}
          </ul>
        ))}
    </>
  );
}

const statusVariants: Record<
  JobStatus,
  "outline" | "secondary" | "default" | "destructive"
> = {
  estimated: "outline",
  scheduled: "secondary",
  completed: "default",
  cancelled: "destructive",
};

function JobCard({ job }: { job: Job }) {
  const start = Temporal.PlainTime.from(job.startTime);
  const end = start.add({ minutes: job.durationMinutes });
  // What the helper is paid for an hour of this job: the rate the job
  // carries, otherwise their usual one. Unknown while neither is set.
  const helperRateCents =
    job.helper === null
      ? null
      : (job.helperHourlyRateCents ?? job.helper.hourlyRateCents);

  return (
    <Card size="sm" className={cn(job.status === "cancelled" && "opacity-60")}>
      <CardContent>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-muted-foreground">
              {formatTime(start)} – {formatTime(end)}
            </p>
            <h2 className="font-heading text-base font-medium">
              <Link
                to={`/clients/${job.client.id}`}
                className="hover:underline"
              >
                {job.client.name}
              </Link>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={statusVariants[job.status]}>
              {jobStatusLabels[job.status]}
            </Badge>
            <Link
              to={`/jobs/${job.id}/edit`}
              aria-label={`Edit job for ${job.client.name}`}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              Edit
            </Link>
          </div>
        </div>
        <address className="mt-2 not-italic">
          <div>{job.property.addressLine1}</div>
          {job.property.addressLine2 !== null && (
            <div>{job.property.addressLine2}</div>
          )}
          <div>{cityLine(job.property)}</div>
        </address>
        {job.property.notes !== null && (
          <p className="mt-1 text-muted-foreground">{job.property.notes}</p>
        )}
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <Detail label="Service">{serviceTypeLabels[job.serviceType]}</Detail>
          <Detail label="Helper">
            {job.helper?.name ?? "No helper"}
            {helperRateCents !== null && (
              <>
                {" "}
                <span className="text-muted-foreground">
                  at {formatMoney(helperRateCents)} an hour
                </span>
              </>
            )}
          </Detail>
          <Detail label="Hours">{formatHours(job.durationMinutes)}</Detail>
          <Detail label="Price">
            {formatMoney(job.priceCents)}{" "}
            <span className="text-muted-foreground">
              {/* The hourly rate only matters when no price was agreed. */}
              {job.fixedPriceCents === null
                ? `at ${formatMoney(job.hourlyRateCents)} an hour`
                : "agreed price"}
            </span>
          </Detail>
          <Detail label="Invoice">
            {job.invoice !== null ? (
              <Link
                to={`/invoices/${job.invoice.id}`}
                className="underline hover:text-muted-foreground"
              >
                #{job.invoice.number}
              </Link>
            ) : (
              <>
                Not invoiced
                {/* Only a visit gets one: not an estimate, not a job that
                    was cancelled. */}
                {canBeInvoiced(job) && (
                  <>
                    {" · "}
                    <Link
                      to={`/jobs/${job.id}/invoice/new`}
                      aria-label={`Generate invoice for ${job.client.name}`}
                      className="underline hover:text-muted-foreground"
                    >
                      Generate invoice
                    </Link>
                  </>
                )}
              </>
            )}
          </Detail>
          {job.notes !== null && <Detail label="Notes">{job.notes}</Detail>}
        </dl>
      </CardContent>
    </Card>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

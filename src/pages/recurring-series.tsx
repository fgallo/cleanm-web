import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { Link } from "react-router";
import { Temporal } from "temporal-polyfill";

import { seriesListQueryOptions } from "@/api/recurring-series.ts";
import { useSession } from "@/auth/session-context.ts";
import RequestFailed from "@/components/request-failed.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatHours, formatTime } from "@/lib/format.ts";
import { repeatsLabel } from "@/lib/series-labels.ts";

// The visits that repeat: each series is the rule and the template the API
// generates a recurring client's jobs from. One that ended stays listed,
// like the visits it generated.
export default function RecurringSeriesPage() {
  const { organization } = useSession();
  const series = useQuery(seriesListQueryOptions);
  // A series has ended once its last day is behind, where the business is.
  const today = Temporal.Now.plainDateISO(organization.timezone).toString();

  return (
    <>
      <h1 className="mb-4 font-heading text-xl font-semibold">
        Recurring series
      </h1>
      {series.isPending && <p className="text-muted-foreground">Loading…</p>}
      {series.isError && (
        <RequestFailed
          error={series.error}
          onRetry={() => void series.refetch()}
        />
      )}
      {series.isSuccess &&
        (series.data.length === 0 ? (
          <p className="text-muted-foreground">No recurring series yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Repeats</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Helper</TableHead>
                <TableHead>Starts</TableHead>
                <TableHead>Ends</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {series.data.map((item) => {
                // YYYY-MM-DD compares as text in calendar order.
                const ended = item.endDate !== null && item.endDate < today;
                return (
                  <TableRow
                    key={item.id}
                    className={cn(ended && "text-muted-foreground")}
                  >
                    <TableCell className="font-medium">
                      <Link
                        to={`/clients/${item.client.id}`}
                        className="hover:underline"
                      >
                        {item.client.name}
                      </Link>
                    </TableCell>
                    <TableCell>{item.property.addressLine1}</TableCell>
                    <TableCell>{repeatsLabel(item)}</TableCell>
                    <TableCell>
                      {formatTime(Temporal.PlainTime.from(item.startTime))} ·{" "}
                      {formatHours(item.durationMinutes)}
                    </TableCell>
                    <TableCell>{item.helper?.name ?? <Missing />}</TableCell>
                    <TableCell>
                      {formatDate(Temporal.PlainDate.from(item.startDate))}
                    </TableCell>
                    <TableCell>
                      {item.endDate === null ? (
                        <Missing />
                      ) : (
                        formatDate(Temporal.PlainDate.from(item.endDate))
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ))}
    </>
  );
}

function Missing() {
  return <span className="text-muted-foreground">—</span>;
}

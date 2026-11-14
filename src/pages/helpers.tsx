import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { Link } from "react-router";

import { helperListQueryOptions } from "@/api/helpers.ts";
import RequestFailed from "@/components/request-failed.tsx";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/format.ts";

// The people who can be sent to a job with the owner. Those who left stay
// listed as inactive: the jobs they did still name them.
export default function HelpersPage() {
  const helpers = useQuery(helperListQueryOptions);

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="font-heading text-xl font-semibold">Helpers</h1>
        <Link to="/helpers/new" className={buttonVariants()}>
          New helper
        </Link>
      </div>
      {helpers.isPending && <p className="text-muted-foreground">Loading…</p>}
      {helpers.isError && (
        <RequestFailed
          error={helpers.error}
          onRetry={() => void helpers.refetch()}
        />
      )}
      {helpers.isSuccess &&
        (helpers.data.length === 0 ? (
          <p className="text-muted-foreground">No helpers yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Hourly rate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {helpers.data.map((helper) => (
                <TableRow key={helper.id}>
                  <TableCell
                    className={cn(
                      "font-medium",
                      !helper.active && "text-muted-foreground",
                    )}
                  >
                    {helper.name}
                  </TableCell>
                  <TableCell>{helper.phone ?? <Missing />}</TableCell>
                  <TableCell>
                    {helper.hourlyRateCents === null ? (
                      <Missing />
                    ) : (
                      formatMoney(helper.hourlyRateCents)
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={helper.active ? "secondary" : "outline"}>
                      {helper.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      to={`/helpers/${helper.id}/edit`}
                      aria-label={`Edit ${helper.name}`}
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "sm" }),
                      )}
                    >
                      Edit
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ))}
    </>
  );
}

function Missing() {
  return <span className="text-muted-foreground">—</span>;
}

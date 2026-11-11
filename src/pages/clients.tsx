import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";

import { clientListQueryOptions } from "@/api/clients.ts";
import RequestFailed from "@/components/request-failed.tsx";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function ClientsPage() {
  const clients = useQuery(clientListQueryOptions);

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="font-heading text-xl font-semibold">Clients</h1>
        <Link to="/clients/new" className={buttonVariants()}>
          New client
        </Link>
      </div>
      {clients.isPending && <p className="text-muted-foreground">Loading…</p>}
      {clients.isError && (
        <RequestFailed
          error={clients.error}
          onRetry={() => void clients.refetch()}
        />
      )}
      {clients.isSuccess &&
        (clients.data.length === 0 ? (
          <p className="text-muted-foreground">No clients yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.data.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">
                    <Link
                      to={`/clients/${client.id}`}
                      className="hover:underline"
                    >
                      {client.name}
                    </Link>
                  </TableCell>
                  <TableCell>{client.email ?? <Missing />}</TableCell>
                  <TableCell>{client.phone ?? <Missing />}</TableCell>
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

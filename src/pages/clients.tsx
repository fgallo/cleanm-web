import { useQuery } from "@tanstack/react-query";

import { clientListQueryOptions } from "@/api/clients.ts";
import RequestFailed from "@/components/request-failed.tsx";
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
      <h1 className="mb-4 font-heading text-xl font-semibold">Clients</h1>
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
                  <TableCell className="font-medium">{client.name}</TableCell>
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

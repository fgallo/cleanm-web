import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";

import { isNotFound } from "@/api/client.ts";
import {
  clientKeys,
  clientQueryOptions,
  updateClient,
  type Client,
  type ClientInput,
} from "@/api/clients.ts";
import ClientForm from "@/components/client-form.tsx";
import RequestFailed from "@/components/request-failed.tsx";

export default function ClientEditPage() {
  const { clientId } = useParams();
  if (clientId === undefined) {
    throw new Error("ClientEditPage is rendered without a :clientId parameter");
  }
  return <ClientEdit clientId={clientId} />;
}

function ClientEdit({ clientId }: { clientId: string }) {
  const client = useQuery(clientQueryOptions(clientId));

  return (
    <>
      <h1 className="mb-4 font-heading text-xl font-semibold">Edit client</h1>
      {client.isPending && <p className="text-muted-foreground">Loading…</p>}
      {client.isError &&
        (isNotFound(client.error) ? (
          <>
            <p role="alert">Client not found.</p>
            <p className="mt-4 text-sm">
              <Link
                to="/clients"
                className="text-muted-foreground hover:text-foreground"
              >
                Back to clients
              </Link>
            </p>
          </>
        ) : (
          <RequestFailed
            error={client.error}
            onRetry={() => void client.refetch()}
          />
        ))}
      {/* Mounted once the client is known: the form copies it into its
          state, and a background refetch must not overwrite what is typed. */}
      {client.isSuccess && <EditForm client={client.data} />}
    </>
  );
}

function EditForm({ client }: { client: Client }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const update = useMutation({
    mutationFn: (input: ClientInput) => updateClient(client.id, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(clientKeys.detail(updated.id), updated);
      void queryClient.invalidateQueries({ queryKey: clientKeys.list() });
      void navigate(`/clients/${updated.id}`);
    },
  });

  return (
    <ClientForm
      client={client}
      submitLabel="Save changes"
      cancelTo={`/clients/${client.id}`}
      pending={update.isPending}
      error={update.error}
      onSubmit={update.mutate}
    />
  );
}

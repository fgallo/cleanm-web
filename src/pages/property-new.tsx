import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";

import { isNotFound } from "@/api/client.ts";
import { clientQueryOptions } from "@/api/clients.ts";
import {
  createProperty,
  propertyKeys,
  type PropertyInput,
} from "@/api/properties.ts";
import PropertyForm from "@/components/property-form.tsx";
import RequestFailed from "@/components/request-failed.tsx";

export default function PropertyNewPage() {
  const { clientId } = useParams();
  if (clientId === undefined) {
    throw new Error(
      "PropertyNewPage is rendered without a :clientId parameter",
    );
  }
  return <PropertyNew clientId={clientId} />;
}

function PropertyNew({ clientId }: { clientId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // The client is read to say whose property this is, and so that a wrong
  // id is reported before anything is typed.
  const client = useQuery(clientQueryOptions(clientId));

  const create = useMutation({
    mutationFn: (input: PropertyInput) => createProperty(clientId, input),
    onSuccess: async (property) => {
      queryClient.setQueryData(propertyKeys.detail(property.id), property);
      await queryClient.invalidateQueries({
        queryKey: propertyKeys.ofClient(clientId),
      });
      void navigate(`/clients/${clientId}`);
    },
  });

  return (
    <>
      <h1 className="mb-4 font-heading text-xl font-semibold">New property</h1>
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
      {client.isSuccess && (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            For {client.data.name}
          </p>
          <PropertyForm
            submitLabel="Add property"
            cancelTo={`/clients/${clientId}`}
            pending={create.isPending}
            error={create.error}
            onSubmit={create.mutate}
          />
        </>
      )}
    </>
  );
}

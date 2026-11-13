import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";

import { isNotFound } from "@/api/client.ts";
import {
  propertyKeys,
  propertyQueryOptions,
  updateProperty,
  type Property,
  type PropertyInput,
} from "@/api/properties.ts";
import PropertyForm from "@/components/property-form.tsx";
import RequestFailed from "@/components/request-failed.tsx";

export default function PropertyEditPage() {
  const { propertyId } = useParams();
  if (propertyId === undefined) {
    throw new Error(
      "PropertyEditPage is rendered without a :propertyId parameter",
    );
  }
  return <PropertyEdit propertyId={propertyId} />;
}

function PropertyEdit({ propertyId }: { propertyId: string }) {
  const property = useQuery(propertyQueryOptions(propertyId));

  return (
    <>
      <h1 className="mb-4 font-heading text-xl font-semibold">Edit property</h1>
      {property.isPending && <p className="text-muted-foreground">Loading…</p>}
      {property.isError &&
        (isNotFound(property.error) ? (
          <>
            <p role="alert">Property not found.</p>
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
            error={property.error}
            onRetry={() => void property.refetch()}
          />
        ))}
      {/* Mounted once the property is known: the form copies it into its
          state, and a background refetch must not overwrite what is typed. */}
      {property.isSuccess && <EditForm property={property.data} />}
    </>
  );
}

function EditForm({ property }: { property: Property }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const update = useMutation({
    mutationFn: (input: PropertyInput) => updateProperty(property.id, input),
    onSuccess: async (updated) => {
      queryClient.setQueryData(propertyKeys.detail(updated.id), updated);
      await queryClient.invalidateQueries({
        queryKey: propertyKeys.ofClient(updated.clientId),
      });
      void navigate(`/clients/${updated.clientId}`);
    },
  });

  return (
    <PropertyForm
      property={property}
      submitLabel="Save changes"
      cancelTo={`/clients/${property.clientId}`}
      pending={update.isPending}
      error={update.error}
      onSubmit={update.mutate}
    />
  );
}

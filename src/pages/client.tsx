import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";

import { isNotFound } from "@/api/client.ts";
import { clientQueryOptions, type Client } from "@/api/clients.ts";
import {
  clientPropertiesQueryOptions,
  type Property,
} from "@/api/properties.ts";
import RequestFailed from "@/components/request-failed.tsx";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ClientPage() {
  const { clientId } = useParams();
  if (clientId === undefined) {
    throw new Error("ClientPage is rendered without a :clientId parameter");
  }
  return <ClientDetails clientId={clientId} />;
}

function ClientDetails({ clientId }: { clientId: string }) {
  const client = useQuery(clientQueryOptions(clientId));
  const properties = useQuery(clientPropertiesQueryOptions(clientId));

  return (
    <>
      <p className="mb-4 text-sm">
        <Link
          to="/clients"
          className="text-muted-foreground hover:text-foreground"
        >
          Back to clients
        </Link>
      </p>
      {client.isPending && <p className="text-muted-foreground">Loading…</p>}
      {client.isError &&
        (isNotFound(client.error) ? (
          <p role="alert">Client not found.</p>
        ) : (
          <RequestFailed
            error={client.error}
            onRetry={() => void client.refetch()}
          />
        ))}
      {client.isSuccess && (
        <>
          <ClientHeader client={client.data} />
          <div className="mt-8 mb-3 flex items-center justify-between gap-4">
            <h2 className="font-heading text-lg font-medium">Properties</h2>
            <Link
              to={`/clients/${clientId}/properties/new`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Add property
            </Link>
          </div>
          {properties.isPending && (
            <p className="text-muted-foreground">Loading…</p>
          )}
          {properties.isError && (
            <RequestFailed
              error={properties.error}
              onRetry={() => void properties.refetch()}
            />
          )}
          {properties.isSuccess &&
            (properties.data.length === 0 ? (
              <p className="text-muted-foreground">No properties yet.</p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {properties.data.map((property) => (
                  <li key={property.id}>
                    <PropertyCard property={property} />
                  </li>
                ))}
              </ul>
            ))}
        </>
      )}
    </>
  );
}

function ClientHeader({ client }: { client: Client }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="font-heading text-xl font-semibold">{client.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {client.email ?? "No email"} · {client.phone ?? "No phone"}
        </p>
      </div>
      <Link
        to={`/clients/${client.id}/edit`}
        className={buttonVariants({ variant: "outline" })}
      >
        Edit
      </Link>
    </div>
  );
}

function PropertyCard({ property }: { property: Property }) {
  return (
    <Card size="sm">
      <CardContent>
        <div className="flex items-start justify-between gap-4">
          <address className="text-sm not-italic">
            <div>{property.addressLine1}</div>
            {property.addressLine2 !== null && (
              <div>{property.addressLine2}</div>
            )}
            <div>{cityLine(property)}</div>
          </address>
          <Link
            to={`/properties/${property.id}/edit`}
            aria-label={`Edit ${property.addressLine1}`}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Edit
          </Link>
        </div>
        {property.notes !== null && (
          <p className="mt-2 text-sm text-muted-foreground">{property.notes}</p>
        )}
      </CardContent>
    </Card>
  );
}

// "Toronto, ON M4B 1B3". The country is shown only when it is not CA, the
// API's default: the first business is in Toronto.
function cityLine({ city, province, postalCode, country }: Property): string {
  const line = `${city}, ${province} ${postalCode}`;
  return country === "CA" ? line : `${line}, ${country}`;
}

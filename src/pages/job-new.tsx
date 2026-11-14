import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Temporal } from "temporal-polyfill";

import { describeFailure, issuesFor } from "@/api/client.ts";
import { clientListQueryOptions, type Client } from "@/api/clients.ts";
import { helperListQueryOptions, type Helper } from "@/api/helpers.ts";
import { createJob, jobKeys, type JobInput } from "@/api/jobs.ts";
import {
  clientPropertiesQueryOptions,
  type Property,
} from "@/api/properties.ts";
import { useSession } from "@/auth/session-context.ts";
import JobForm from "@/components/job-form.tsx";
import RequestFailed from "@/components/request-failed.tsx";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { parseDay } from "@/lib/dates.ts";

// A one-off job: a visit on one day, with no series behind it.
export default function JobNewPage() {
  const { organization } = useSession();
  const [searchParams] = useSearchParams();
  // `?date=` is the day whose page asked for the job. Without it the job
  // is offered for today, which is a day where the organization is, not
  // where the browser is.
  const asked = parseDay(searchParams.get("date") ?? "");
  const defaultDate = (
    asked ?? Temporal.Now.plainDateISO(organization.timezone)
  ).toString();
  const cancelTo =
    asked === null ? "/calendar" : `/calendar/${asked.toString()}`;

  // Who the job can be for, and who can be sent to help.
  const clients = useQuery(clientListQueryOptions);
  const helpers = useQuery(helperListQueryOptions);

  return (
    <>
      <h1 className="mb-4 font-heading text-xl font-semibold">New job</h1>
      {clients.isError ? (
        <RequestFailed
          error={clients.error}
          onRetry={() => void clients.refetch()}
        />
      ) : helpers.isError ? (
        <RequestFailed
          error={helpers.error}
          onRetry={() => void helpers.refetch()}
        />
      ) : clients.isPending || helpers.isPending ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <NewForm
          defaultDate={defaultDate}
          cancelTo={cancelTo}
          clients={clients.data}
          helpers={helpers.data}
        />
      )}
    </>
  );
}

function NewForm({
  defaultDate,
  cancelTo,
  clients,
  helpers,
}: {
  defaultDate: string;
  cancelTo: string;
  clients: Client[];
  helpers: Helper[];
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // A job is at a property, and a property is found through its client.
  const [clientId, setClientId] = useState("");
  const [pickedPropertyId, setPickedPropertyId] = useState("");
  const properties = useQuery({
    ...clientPropertiesQueryOptions(clientId),
    enabled: clientId !== "",
  });
  // Most clients have one property, and that one needs no picking. Derived
  // on every render, so there is no state to keep in step with the list.
  const onlyProperty =
    properties.data?.length === 1 ? properties.data[0] : undefined;
  const propertyId =
    pickedPropertyId !== "" ? pickedPropertyId : (onlyProperty?.id ?? "");

  const create = useMutation({
    mutationFn: (input: JobInput) => createJob({ ...input, propertyId }),
    onSuccess: async (job) => {
      queryClient.setQueryData(jobKeys.detail(job.id), job);
      await queryClient.invalidateQueries({ queryKey: jobKeys.ranges() });
      void navigate(`/calendar/${job.scheduledDate}`);
    },
  });
  const propertyIssues = issuesFor(create.error, "propertyId");

  return (
    <JobForm
      defaultDate={defaultDate}
      helpers={helpers}
      submitLabel="Add job"
      cancelTo={cancelTo}
      pending={create.isPending}
      error={create.error}
      onSubmit={create.mutate}
    >
      <Field>
        <FieldLabel htmlFor="clientId">Client</FieldLabel>
        <NativeSelect
          id="clientId"
          className="w-full"
          required
          aria-describedby={
            clients.length === 0 ? "clientId-description" : undefined
          }
          value={clientId}
          onChange={(event) => {
            setClientId(event.target.value);
            // The property picked belonged to the previous client.
            setPickedPropertyId("");
          }}
        >
          <NativeSelectOption value="">Choose a client</NativeSelectOption>
          {clients.map((client) => (
            <NativeSelectOption key={client.id} value={client.id}>
              {client.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {clients.length === 0 && (
          <FieldDescription id="clientId-description">
            No clients yet. <Link to="/clients/new">Add a client</Link> first.
          </FieldDescription>
        )}
      </Field>
      <Field data-invalid={propertyIssues.length > 0}>
        <FieldLabel htmlFor="propertyId">Property</FieldLabel>
        {/* Never disabled: a disabled field is left out of the browser's
            validation, and `required` is what stops a job with no property
            from being sent. */}
        <NativeSelect
          id="propertyId"
          className="w-full"
          required
          aria-invalid={propertyIssues.length > 0}
          value={propertyId}
          onChange={(event) => setPickedPropertyId(event.target.value)}
        >
          <NativeSelectOption value="">
            {clientId === ""
              ? "Choose a client first"
              : properties.isPending
                ? "Loading…"
                : "Choose a property"}
          </NativeSelectOption>
          {properties.data?.map((property) => (
            <NativeSelectOption key={property.id} value={property.id}>
              {propertyLabel(property)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {properties.data?.length === 0 && (
          <FieldDescription>
            This client has no property yet.{" "}
            <Link to={`/clients/${clientId}/properties/new`}>
              Add a property
            </Link>{" "}
            first.
          </FieldDescription>
        )}
        {properties.isError && (
          <FieldError>{describeFailure(properties.error)}</FieldError>
        )}
        <FieldError errors={propertyIssues} />
      </Field>
    </JobForm>
  );
}

// "456 Sample Ave, Unit 2, Toronto": enough to tell a client's properties
// apart.
function propertyLabel(property: Property): string {
  return [property.addressLine1, property.addressLine2, property.city]
    .filter((part) => part !== null)
    .join(", ");
}

import { Link } from "react-router";

import { describeFailure, issuesFor } from "@/api/client.ts";
import type { Client } from "@/api/clients.ts";
import type { Property } from "@/api/properties.ts";
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
import type { PropertyChoice } from "@/lib/use-property-choice.ts";

// The client and the property of a new job or a new series, as fields a
// page puts inside the form. The page keeps the choice
// (`usePropertyChoice`) and sends its `propertyId`.
export default function PropertyChoiceFields({
  clients,
  choice,
  error,
}: {
  clients: Client[];
  choice: PropertyChoice;
  // What the last attempt to save failed with.
  error: Error | null;
}) {
  const { clientId, propertyId, properties } = choice;
  const propertyIssues = issuesFor(error, "propertyId");

  return (
    <>
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
          onChange={(event) => choice.chooseClient(event.target.value)}
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
            validation, and `required` is what stops a form with no property
            from being sent. */}
        <NativeSelect
          id="propertyId"
          className="w-full"
          required
          aria-invalid={propertyIssues.length > 0}
          value={propertyId}
          onChange={(event) => choice.chooseProperty(event.target.value)}
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
    </>
  );
}

// "456 Sample Ave, Unit 2, Toronto": enough to tell a client's properties
// apart.
function propertyLabel(property: Property): string {
  return [property.addressLine1, property.addressLine2, property.city]
    .filter((part) => part !== null)
    .join(", ");
}

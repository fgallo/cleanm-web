import { useState, type FormEvent } from "react";
import { Link } from "react-router";

import { describeOutsideFields, issuesFor } from "@/api/client.ts";
import type { Property, PropertyInput } from "@/api/properties.ts";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { emptyAsNull } from "@/lib/form.ts";

const fields = [
  "addressLine1",
  "addressLine2",
  "city",
  "province",
  "postalCode",
  "country",
  "notes",
] as const;

// The address and house notes of a property, for adding one to a client
// (`property` absent) and for editing one. Like the client form, the page
// owns the request and passes what the last attempt failed with.
export default function PropertyForm({
  property,
  submitLabel,
  cancelTo,
  pending,
  error,
  onSubmit,
}: {
  property?: Property;
  submitLabel: string;
  cancelTo: string;
  pending: boolean;
  error: Error | null;
  onSubmit: (input: PropertyInput) => void;
}) {
  const [addressLine1, setAddressLine1] = useState(
    property?.addressLine1 ?? "",
  );
  const [addressLine2, setAddressLine2] = useState(
    property?.addressLine2 ?? "",
  );
  const [city, setCity] = useState(property?.city ?? "");
  const [province, setProvince] = useState(property?.province ?? "");
  const [postalCode, setPostalCode] = useState(property?.postalCode ?? "");
  // CA is the API's own default; showing it lets the owner see and change it.
  const [country, setCountry] = useState(property?.country ?? "CA");
  const [notes, setNotes] = useState(property?.notes ?? "");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({
      addressLine1,
      addressLine2: emptyAsNull(addressLine2),
      city,
      province,
      postalCode,
      country,
      notes: emptyAsNull(notes),
    });
  }

  const issues = {
    addressLine1: issuesFor(error, "addressLine1"),
    addressLine2: issuesFor(error, "addressLine2"),
    city: issuesFor(error, "city"),
    province: issuesFor(error, "province"),
    postalCode: issuesFor(error, "postalCode"),
    country: issuesFor(error, "country"),
    notes: issuesFor(error, "notes"),
  };
  const formMessage =
    error === null ? null : describeOutsideFields(error, fields);

  return (
    <form onSubmit={handleSubmit} className="max-w-md">
      <FieldGroup>
        <Field data-invalid={issues.addressLine1.length > 0}>
          <FieldLabel htmlFor="addressLine1">Address</FieldLabel>
          <Input
            id="addressLine1"
            autoComplete="off"
            required
            maxLength={200}
            aria-invalid={issues.addressLine1.length > 0}
            value={addressLine1}
            onChange={(event) => setAddressLine1(event.target.value)}
          />
          <FieldError errors={issues.addressLine1} />
        </Field>
        <Field data-invalid={issues.addressLine2.length > 0}>
          <FieldLabel htmlFor="addressLine2">Unit or suite</FieldLabel>
          <Input
            id="addressLine2"
            autoComplete="off"
            maxLength={200}
            aria-invalid={issues.addressLine2.length > 0}
            value={addressLine2}
            onChange={(event) => setAddressLine2(event.target.value)}
          />
          <FieldError errors={issues.addressLine2} />
        </Field>
        <Field data-invalid={issues.city.length > 0}>
          <FieldLabel htmlFor="city">City</FieldLabel>
          <Input
            id="city"
            autoComplete="off"
            required
            maxLength={100}
            aria-invalid={issues.city.length > 0}
            value={city}
            onChange={(event) => setCity(event.target.value)}
          />
          <FieldError errors={issues.city} />
        </Field>
        <div className="grid grid-cols-3 gap-4">
          <Field data-invalid={issues.province.length > 0}>
            <FieldLabel htmlFor="province">Province</FieldLabel>
            <Input
              id="province"
              autoComplete="off"
              required
              maxLength={100}
              aria-invalid={issues.province.length > 0}
              value={province}
              onChange={(event) => setProvince(event.target.value)}
            />
            <FieldError errors={issues.province} />
          </Field>
          <Field data-invalid={issues.postalCode.length > 0}>
            <FieldLabel htmlFor="postalCode">Postal code</FieldLabel>
            <Input
              id="postalCode"
              autoComplete="off"
              required
              maxLength={20}
              aria-invalid={issues.postalCode.length > 0}
              value={postalCode}
              onChange={(event) => setPostalCode(event.target.value)}
            />
            <FieldError errors={issues.postalCode} />
          </Field>
          <Field data-invalid={issues.country.length > 0}>
            <FieldLabel htmlFor="country">Country</FieldLabel>
            <Input
              id="country"
              autoComplete="off"
              required
              minLength={2}
              maxLength={2}
              aria-invalid={issues.country.length > 0}
              value={country}
              onChange={(event) => setCountry(event.target.value)}
            />
            <FieldError errors={issues.country} />
          </Field>
        </div>
        <Field data-invalid={issues.notes.length > 0}>
          <FieldLabel htmlFor="notes">Notes about the house</FieldLabel>
          <Textarea
            id="notes"
            maxLength={2000}
            aria-invalid={issues.notes.length > 0}
            aria-describedby="notes-description"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
          <FieldDescription id="notes-description">
            Keys, pets, alarm, parking: what to know before a visit.
          </FieldDescription>
          <FieldError errors={issues.notes} />
        </Field>
        {formMessage !== null && <FieldError>{formMessage}</FieldError>}
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {submitLabel}
          </Button>
          <Link to={cancelTo} className={buttonVariants({ variant: "ghost" })}>
            Cancel
          </Link>
        </div>
      </FieldGroup>
    </form>
  );
}

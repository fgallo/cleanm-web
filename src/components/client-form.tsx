import { useState, type FormEvent } from "react";
import { Link } from "react-router";

import { ApiError, describeFailure, issuesFor } from "@/api/client.ts";
import type { Client, ClientInput } from "@/api/clients.ts";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const fields = ["name", "email", "phone"] as const;

// The fields of a client, for creating one (`client` absent) and for
// editing one. The page owns the request: it passes what the last attempt
// failed with, and the API's issues are shown under the field they name.
export default function ClientForm({
  client,
  submitLabel,
  cancelTo,
  pending,
  error,
  onSubmit,
}: {
  client?: Client;
  submitLabel: string;
  cancelTo: string;
  pending: boolean;
  error: Error | null;
  onSubmit: (input: ClientInput) => void;
}) {
  const [name, setName] = useState(client?.name ?? "");
  const [email, setEmail] = useState(client?.email ?? "");
  const [phone, setPhone] = useState(client?.phone ?? "");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({ name, email: emptyAsNull(email), phone: emptyAsNull(phone) });
  }

  const nameIssues = issuesFor(error, "name");
  const emailIssues = issuesFor(error, "email");
  const phoneIssues = issuesFor(error, "phone");
  const formMessage = error === null ? null : describeOutsideFields(error);

  return (
    <form onSubmit={handleSubmit} className="max-w-md">
      <FieldGroup>
        <Field data-invalid={nameIssues.length > 0}>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input
            id="name"
            autoComplete="off"
            required
            maxLength={200}
            aria-invalid={nameIssues.length > 0}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <FieldError errors={nameIssues} />
        </Field>
        <Field data-invalid={emailIssues.length > 0}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="off"
            maxLength={320}
            aria-invalid={emailIssues.length > 0}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <FieldError errors={emailIssues} />
        </Field>
        <Field data-invalid={phoneIssues.length > 0}>
          <FieldLabel htmlFor="phone">Phone</FieldLabel>
          <Input
            id="phone"
            type="tel"
            autoComplete="off"
            maxLength={50}
            aria-invalid={phoneIssues.length > 0}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
          <FieldError errors={phoneIssues} />
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

// An optional field left blank is sent as `null`: the API takes no empty
// string for email or phone.
function emptyAsNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

// What the form says below its fields: a failure that is not about them
// (the API is down, the client was deleted meanwhile), or the issues that
// name no field of this form. `null` when every issue has its field.
function describeOutsideFields(error: Error): string | null {
  if (!(error instanceof ApiError) || error.issues.length === 0) {
    return describeFailure(error);
  }
  const others = error.issues.filter(
    (issue) => !(fields as readonly string[]).includes(issue.path),
  );
  return others.length === 0
    ? null
    : others.map((issue) => issue.message).join(". ");
}

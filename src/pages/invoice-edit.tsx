import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { isNotFound } from "@/api/client.ts";
import {
  invoiceKeys,
  invoiceQueryOptions,
  updateInvoice,
  type Invoice,
  type InvoiceInput,
} from "@/api/invoices.ts";
import InvoiceForm from "@/components/invoice-form.tsx";
import InvoicePricingFields from "@/components/invoice-pricing-fields.tsx";
import RequestFailed from "@/components/request-failed.tsx";
import {
  fromPricingDraft,
  subtotalCents,
  toDraft,
  toPricingDraft,
} from "@/lib/invoice-draft.ts";

// The invoice itself is what the owner edits: its dates, its line, what it
// charges, a discount and the notes. Until it is paid in full; its number
// stays whatever changes.
export default function InvoiceEditPage() {
  const { invoiceId } = useParams();
  if (invoiceId === undefined) {
    throw new Error(
      "InvoiceEditPage is rendered without an :invoiceId parameter",
    );
  }
  return <InvoiceEdit invoiceId={invoiceId} />;
}

function InvoiceEdit({ invoiceId }: { invoiceId: string }) {
  const invoice = useQuery(invoiceQueryOptions(invoiceId));

  return (
    <>
      <h1 className="mb-4 font-heading text-xl font-semibold">Edit invoice</h1>
      {invoice.isPending && <p className="text-muted-foreground">Loading…</p>}
      {invoice.isError &&
        (isNotFound(invoice.error) ? (
          <>
            <p role="alert">Invoice not found.</p>
            <p className="mt-4 text-sm">
              <Link
                to="/calendar"
                className="text-muted-foreground hover:text-foreground"
              >
                Back to calendar
              </Link>
            </p>
          </>
        ) : (
          <RequestFailed
            error={invoice.error}
            onRetry={() => void invoice.refetch()}
          />
        ))}
      {/* Mounted once the invoice is known: the form copies it into its
          state, and a background refetch must not overwrite what is typed. */}
      {invoice.isSuccess &&
        (invoice.data.locked ? (
          <Closed invoice={invoice.data} />
        ) : (
          <EditForm invoice={invoice.data} />
        ))}
    </>
  );
}

// An invoice paid in full is a closed document: the API refuses to edit it,
// so no form is offered.
function Closed({ invoice }: { invoice: Invoice }) {
  return (
    <>
      <p role="alert">
        Invoice #{invoice.number} is paid in full, so it is closed: it can no
        longer be edited.
      </p>
      <p className="mt-4 text-sm">
        <Link
          to={`/invoices/${invoice.id}`}
          className="text-muted-foreground hover:text-foreground"
        >
          Back to the invoice
        </Link>
      </p>
    </>
  );
}

function EditForm({ invoice }: { invoice: Invoice }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const invoicePath = `/invoices/${invoice.id}`;
  // Kept here and not by the form: the form needs what these fields come
  // to, since the discount is taken off it.
  const [pricing, setPricing] = useState(() => toPricingDraft(invoice));

  const update = useMutation({
    mutationFn: (input: InvoiceInput) =>
      updateInvoice(invoice, { ...input, ...fromPricingDraft(pricing) }),
    onSuccess: (updated) => {
      // Its page shows the answer, with the amounts the API derived.
      queryClient.setQueryData(invoiceKeys.detail(updated.id), updated);
      void navigate(invoicePath);
    },
  });

  return (
    <>
      <div className="mb-4 max-w-md text-sm text-muted-foreground">
        <p>
          #{invoice.number} · {invoice.billTo.name} ·{" "}
          {invoice.billTo.addressLine1}
        </p>
        <p className="mt-1">
          What changes here changes this invoice alone: the job it bills stays
          as it is.
        </p>
      </div>
      <InvoiceForm
        initial={toDraft(invoice)}
        subtotalCents={subtotalCents(pricing)}
        submitLabel="Save changes"
        cancelTo={invoicePath}
        pending={update.isPending}
        error={update.error}
        onSubmit={update.mutate}
      >
        <InvoicePricingFields
          draft={pricing}
          onChange={setPricing}
          error={update.error}
        />
      </InvoiceForm>
    </>
  );
}

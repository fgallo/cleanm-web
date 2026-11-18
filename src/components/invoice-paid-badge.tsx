import type { Invoice } from "@/api/invoices.ts";
import { Badge } from "@/components/ui/badge";

// How much of an invoice came in, as its page and the list of a month say
// it. Paid once the payments cover the total (brief, design rule 3).
export default function InvoicePaidBadge({
  invoice,
}: {
  invoice: Pick<Invoice, "paid" | "paidCents">;
}) {
  if (invoice.paid) {
    return <Badge>Paid</Badge>;
  }
  return invoice.paidCents === 0 ? (
    <Badge variant="outline">Unpaid</Badge>
  ) : (
    <Badge variant="secondary">Partly paid</Badge>
  );
}

import type { Invoice, PaymentMethod } from "@/api/invoices.ts";
import type { ServiceType } from "@/api/jobs.ts";
import { formatPercent } from "@/lib/format.ts";

// How the API's values read on screen. The lines of an invoice are named as
// its PDF names them (`src/invoices/pdf/template.ts` in the API), so the
// page and the document say the same.
export const paymentMethodLabels: Record<PaymentMethod, string> = {
  e_transfer: "E-transfer",
  cash: "Cash",
};

// What an invoice is usually for: a kind of cleaning, as the client reads
// it. The API gives the same item to an invoice sent without one
// (`src/invoices/item.ts` there).
export const invoiceItems: Record<ServiceType, string> = {
  regular: "Regular cleaning",
  deep: "Deep cleaning",
  move_in: "Move-in cleaning",
  move_out: "Move-out cleaning",
};

// "Discount", or what the owner wrote, with the percentage when it is one.
export function discountLabel(
  invoice: Pick<Invoice, "discountDescription" | "discountBasisPoints">,
): string {
  const what = invoice.discountDescription ?? "Discount";
  return invoice.discountBasisPoints === null
    ? what
    : `${what} (${formatPercent(invoice.discountBasisPoints)})`;
}

// "HST (13%)".
export function taxLabel(
  invoice: Pick<Invoice, "taxName" | "taxRateBasisPoints">,
): string {
  return `${invoice.taxName ?? "Tax"} (${formatPercent(invoice.taxRateBasisPoints)})`;
}

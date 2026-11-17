import { Route, Routes } from "react-router";

import RequireSession from "@/auth/require-session.tsx";
import AppShell from "@/components/app-shell.tsx";
import CalendarPage from "@/pages/calendar.tsx";
import ClientEditPage from "@/pages/client-edit.tsx";
import ClientNewPage from "@/pages/client-new.tsx";
import ClientPage from "@/pages/client.tsx";
import ClientsPage from "@/pages/clients.tsx";
import DayPage from "@/pages/day.tsx";
import HelperEditPage from "@/pages/helper-edit.tsx";
import HelperNewPage from "@/pages/helper-new.tsx";
import HelpersPage from "@/pages/helpers.tsx";
import HomePage from "@/pages/home.tsx";
import InvoiceEditPage from "@/pages/invoice-edit.tsx";
import InvoiceNewPage from "@/pages/invoice-new.tsx";
import InvoicePage from "@/pages/invoice.tsx";
import JobEditPage from "@/pages/job-edit.tsx";
import JobNewPage from "@/pages/job-new.tsx";
import PropertyEditPage from "@/pages/property-edit.tsx";
import PropertyNewPage from "@/pages/property-new.tsx";
import RecurringSeriesEditPage from "@/pages/recurring-series-edit.tsx";
import RecurringSeriesNewPage from "@/pages/recurring-series-new.tsx";
import RecurringSeriesPage from "@/pages/recurring-series.tsx";
import SignInPage from "@/pages/sign-in.tsx";

// Every route of the client. `/sign-in` is the only public one; the rest
// render inside the shell, for a signed-in user.
export default function App() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignInPage />} />
      <Route element={<RequireSession />}>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="calendar/:date" element={<DayPage />} />
          <Route path="helpers" element={<HelpersPage />} />
          <Route path="helpers/new" element={<HelperNewPage />} />
          <Route path="helpers/:helperId/edit" element={<HelperEditPage />} />
          <Route path="invoices/:invoiceId" element={<InvoicePage />} />
          <Route
            path="invoices/:invoiceId/edit"
            element={<InvoiceEditPage />}
          />
          <Route path="jobs/new" element={<JobNewPage />} />
          <Route path="jobs/:jobId/edit" element={<JobEditPage />} />
          <Route path="jobs/:jobId/invoice/new" element={<InvoiceNewPage />} />
          <Route path="recurring-series" element={<RecurringSeriesPage />} />
          <Route
            path="recurring-series/new"
            element={<RecurringSeriesNewPage />}
          />
          <Route
            path="recurring-series/:seriesId/edit"
            element={<RecurringSeriesEditPage />}
          />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="clients/new" element={<ClientNewPage />} />
          <Route path="clients/:clientId" element={<ClientPage />} />
          <Route path="clients/:clientId/edit" element={<ClientEditPage />} />
          <Route
            path="clients/:clientId/properties/new"
            element={<PropertyNewPage />}
          />
          <Route
            path="properties/:propertyId/edit"
            element={<PropertyEditPage />}
          />
        </Route>
      </Route>
    </Routes>
  );
}

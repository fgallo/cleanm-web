import { Route, Routes } from "react-router";

import RequireSession from "@/auth/require-session.tsx";
import AppShell from "@/components/app-shell.tsx";
import ClientEditPage from "@/pages/client-edit.tsx";
import ClientNewPage from "@/pages/client-new.tsx";
import ClientPage from "@/pages/client.tsx";
import ClientsPage from "@/pages/clients.tsx";
import HomePage from "@/pages/home.tsx";
import PropertyEditPage from "@/pages/property-edit.tsx";
import PropertyNewPage from "@/pages/property-new.tsx";
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

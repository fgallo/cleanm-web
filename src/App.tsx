import { Route, Routes } from "react-router";

import RequireSession from "@/auth/require-session.tsx";
import AppShell from "@/components/app-shell.tsx";
import ClientPage from "@/pages/client.tsx";
import ClientsPage from "@/pages/clients.tsx";
import HomePage from "@/pages/home.tsx";
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
          <Route path="clients/:clientId" element={<ClientPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Navigate, Outlet, useLocation } from "react-router";

import { sessionQueryOptions } from "@/api/auth.ts";
import { describeFailure } from "@/api/client.ts";
import { SessionContext } from "@/auth/session-context.ts";
import { Button } from "@/components/ui/button";

// Layout route for everything that needs a signed-in user: asks the API who
// is signed in, sends the browser to the sign-in page when nobody is, and
// provides the session to the routes below.
export default function RequireSession() {
  const location = useLocation();
  const session = useQuery(sessionQueryOptions);

  if (session.isPending) {
    return <p className="p-6 text-muted-foreground">Loading…</p>;
  }
  if (session.isError) {
    return (
      <div className="flex flex-col items-start gap-3 p-6">
        <p role="alert">{describeFailure(session.error)}</p>
        <Button variant="outline" onClick={() => void session.refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  if (session.data === null) {
    // Remembered so that sign-in can come back here.
    return (
      <Navigate
        to="/sign-in"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }
  return (
    <SessionContext value={session.data}>
      <Outlet />
    </SessionContext>
  );
}

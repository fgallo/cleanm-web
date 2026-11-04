import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, Outlet, useNavigate } from "react-router";

import { signOut } from "@/api/auth.ts";
import { useSession } from "@/auth/session-context.ts";
import { Button } from "@/components/ui/button";

// The frame around every signed-in page: a header with the organization,
// the user and sign-out. The page itself renders in the outlet.
export default function AppShell() {
  const { user, organization } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      // Nothing of this organization stays cached for the next person at
      // this browser; the sign-in page mounts with an empty cache.
      queryClient.clear();
      void navigate("/sign-in", { replace: true });
    },
  });

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <Link to="/" className="font-heading font-semibold">
          CleanM
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">
            {user.name} · {organization.name}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={signOutMutation.isPending}
            onClick={() => signOutMutation.mutate()}
          >
            Sign out
          </Button>
        </div>
      </header>
      {signOutMutation.isError && (
        <p role="alert" className="border-b px-6 py-2 text-sm text-destructive">
          Could not sign out: {signOutMutation.error.message}
        </p>
      )}
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}

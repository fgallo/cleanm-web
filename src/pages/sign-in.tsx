import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router";

import { sessionQueryOptions, signIn } from "@/api/auth.ts";
import { ApiError } from "@/api/client.ts";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export default function SignInPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const signInMutation = useMutation({
    mutationFn: signIn,
    onSuccess: (session) => {
      // The response has the same shape as GET /auth/me, so the session is
      // known without a second request.
      queryClient.setQueryData(sessionQueryOptions.queryKey, session);
      void navigate(redirectTarget(location.state), { replace: true });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    signInMutation.mutate({ email, password });
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <h1>Sign in to CleanM</h1>
          </CardTitle>
          <CardDescription>
            With the email and password of your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </Field>
              {signInMutation.isError && (
                <FieldError>{describe(signInMutation.error)}</FieldError>
              )}
              <Button type="submit" disabled={signInMutation.isPending}>
                Sign in
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

// Where RequireSession sent the browser from, so that sign-in returns there.
function redirectTarget(state: unknown): string {
  if (
    typeof state === "object" &&
    state !== null &&
    "from" in state &&
    typeof state.from === "string"
  ) {
    return state.from;
  }
  return "/";
}

// What the person can act on: the API's own message for a refused sign-in,
// one line for a connection that failed.
function describe(error: Error): string {
  if (error instanceof ApiError) {
    return error.issues.length > 0
      ? error.issues.map((issue) => issue.message).join(". ")
      : error.message;
  }
  return "Could not reach the API. Check that it is running and try again.";
}

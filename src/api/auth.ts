import { queryOptions } from "@tanstack/react-query";

import { ApiError, get, post } from "./client.ts";

// The shapes GET /auth/me and POST /auth/login return.
export type User = {
  id: string;
  organizationId: string;
  email: string;
  name: string;
};

export type Organization = {
  id: string;
  name: string;
  timezone: string;
};

export type Session = { user: User; organization: Organization };

export type Credentials = { email: string; password: string };

// `null` when nobody is signed in: for the session, a 401 is an answer, not
// a failure, so the gate can redirect instead of showing an error.
export async function fetchSession(): Promise<Session | null> {
  try {
    return await get<Session>("/auth/me");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

export const sessionQueryOptions = queryOptions({
  queryKey: ["session"],
  queryFn: fetchSession,
  // Signing in and out write this entry themselves. Refetching only serves
  // to notice a session that expired, and five minutes is soon enough.
  staleTime: 5 * 60 * 1000,
});

export function signIn(credentials: Credentials): Promise<Session> {
  return post<Session>("/auth/login", credentials);
}

export async function signOut(): Promise<void> {
  try {
    await post<void>("/auth/logout");
  } catch (error) {
    // A session that already expired is signed out as well.
    if (!(error instanceof ApiError && error.status === 401)) {
      throw error;
    }
  }
}

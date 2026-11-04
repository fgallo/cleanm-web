import { createContext, useContext } from "react";

import type { Session } from "@/api/auth.ts";

export const SessionContext = createContext<Session | null>(null);

// The signed-in user and organization. Only the routes under RequireSession
// render with one, so there it never returns null.
export function useSession(): Session {
  const session = useContext(SessionContext);
  if (session === null) {
    throw new Error("useSession was called outside RequireSession");
  }
  return session;
}

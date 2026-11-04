import { useSession } from "@/auth/session-context.ts";

// Placeholder until the calendar arrives.
export default function HomePage() {
  const { user } = useSession();
  return (
    <h1 className="font-heading text-xl font-semibold">Welcome, {user.name}</h1>
  );
}

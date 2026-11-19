import { redirect } from "next/navigation";
import { getAuthUser, getSessionUser } from "@/lib/current-user";
import type { Role } from "@/lib/permissions";

/**
 * Resolve the current authenticated user's role. Redirects to /login if there
 * is no session. Returns "STAFF" as a safe default if the role row is missing.
 * Uses the request-cached session (shared with the dashboard layout), so a
 * route-guard layout adds no extra Auth/DB round trips.
 */
export async function getCurrentRole(): Promise<Role> {
  if (!(await getAuthUser())) redirect("/login");
  const dbUser = await getSessionUser();
  return (dbUser?.role ?? "STAFF") as Role;
}

/**
 * Returns true if the current user's role is in {@link allowed}.
 * Used by route layouts to gate direct-URL access alongside menu filtering.
 */
export async function hasRole(allowed: Role[]): Promise<boolean> {
  const role = await getCurrentRole();
  return allowed.includes(role);
}

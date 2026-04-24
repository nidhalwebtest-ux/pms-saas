import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/permissions";

/**
 * Resolve the current authenticated user's role. Redirects to /login if there
 * is no session. Returns "STAFF" as a safe default if the role row is missing.
 */
export async function getCurrentRole(): Promise<Role> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });
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

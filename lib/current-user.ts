import { cache } from "react";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";

/**
 * Request-level cached auth/session resolution.
 *
 * `supabase.auth.getUser()` is a NETWORK round-trip to Supabase Auth, and the
 * `prisma.user` lookup is a DB hit. Many helpers (requireOrgUser,
 * getSessionAccess, property scoping, the dashboard layout, getCurrentOrg, …)
 * each used to re-run BOTH on every call — 3–5× per page render. Wrapping them
 * in React.cache() dedupes to a single getUser + a single user query per
 * request, which removes most of the per-navigation latency.
 */

/** The authenticated Supabase user, validated once per request (or null). */
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});

/**
 * The current user's DB row — a superset of the fields every caller needs —
 * fetched once per request. Returns null if unauthenticated or the row is gone.
 */
export const getSessionUser = cache(async () => {
  const user = await getAuthUser();
  if (!user) return null;
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      organizationId: true,
      role: true,
      firstName: true,
      assignedRole: { select: { key: true, name: true, permissions: true } },
      organization: { select: { id: true, name: true, currency: true, logo: true } },
    },
  });
  if (!dbUser) return null;
  return { ...dbUser, email: user.email ?? null };
});

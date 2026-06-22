import { createClient } from "@/utils/supabase/server";

/**
 * Founder / super-admin gate for the internal admin area (app/(admin)/*).
 *
 * This is deliberately OUTSIDE the per-organization RBAC system (lib/access.ts):
 * a super-admin sits above all tenants, which the tenant-scoped UserRole/Role
 * models cannot express. We gate by an env-var email allowlist instead — no
 * migration, no coupling to tenant roles, trivially revocable.
 *
 *   SUPER_ADMIN_EMAILS=founder@example.com,partner@example.com
 *
 * The matched user still uses normal Supabase auth; super-admin is just an
 * orthogonal capability checked here.
 */

/** Parsed, lower-cased allowlist from SUPER_ADMIN_EMAILS. */
export function superAdminEmails(): string[] {
  return (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export interface SuperAdmin {
  id: string;
  email: string;
}

/**
 * Returns the current super-admin (id + email) or null if the signed-in user is
 * not on the allowlist (or nobody is signed in).
 */
export async function getSuperAdmin(): Promise<SuperAdmin | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const allowed = superAdminEmails();
  if (allowed.length === 0) return null;
  if (!allowed.includes(user.email.toLowerCase())) return null;

  return { id: user.id, email: user.email };
}

/** Boolean convenience wrapper. */
export async function isSuperAdmin(): Promise<boolean> {
  return (await getSuperAdmin()) !== null;
}

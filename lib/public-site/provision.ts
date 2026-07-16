import "server-only";

/**
 * Attach/detach a tenant's `{slug}.binaya.app` subdomain to the Vercel project
 * at publish time (the "Vercel Platforms" per-tenant domain pattern). Works with
 * the existing wildcard CNAME — no nameserver delegation required.
 *
 * Degrades gracefully: if VERCEL_API_TOKEN / VERCEL_PROJECT_ID are not set (e.g.
 * local dev, or the `demo` domain that was added by hand), it no-ops and reports
 * `skipped` so publishing still succeeds.
 */

const ROOT = "binaya.app";

function config() {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;
  return { token, projectId, teamId };
}

export type ProvisionResult = { ok: boolean; skipped?: boolean; error?: string };

export function tenantHost(slug: string): string {
  return `${slug}.${ROOT}`;
}

/** Register `{slug}.binaya.app` with the Vercel project so it routes + gets TLS. */
export async function addTenantDomain(slug: string): Promise<ProvisionResult> {
  const { token, projectId, teamId } = config();
  if (!token || !projectId) return { ok: true, skipped: true };

  const qs = teamId ? `?teamId=${teamId}` : "";
  try {
    const res = await fetch(`https://api.vercel.com/v10/projects/${projectId}/domains${qs}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: tenantHost(slug) }),
    });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => ({}));
    const code = body?.error?.code;
    // Already attached to this project → idempotent success.
    if (res.status === 409 || code === "domain_already_in_use") return { ok: true };
    return { ok: false, error: body?.error?.message || `vercel_http_${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "vercel_unreachable" };
  }
}

/** Remove `{slug}.binaya.app` from the project (used if a slug changes). */
export async function removeTenantDomain(slug: string): Promise<ProvisionResult> {
  const { token, projectId, teamId } = config();
  if (!token || !projectId) return { ok: true, skipped: true };

  const qs = teamId ? `?teamId=${teamId}` : "";
  try {
    const res = await fetch(
      `https://api.vercel.com/v9/projects/${projectId}/domains/${tenantHost(slug)}${qs}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
    );
    if (res.ok || res.status === 404) return { ok: true };
    return { ok: false, error: `vercel_http_${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "vercel_unreachable" };
  }
}

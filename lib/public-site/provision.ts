import "server-only";

/**
 * Attach/detach a tenant's `{slug}.binaya.app` subdomain to the Vercel project
 * (the "Vercel Platforms" per-tenant domain pattern) — the API equivalent of
 * `vercel domains add {slug}.binaya.app`. Works with the existing wildcard CNAME;
 * no nameserver delegation needed. Vercel then issues the TLS certificate.
 *
 * Self-healing — a site never depends on one API call succeeding:
 *   1. publish / go-live calls addTenantDomain (retried on transient errors),
 *   2. opening Settings → Website runs ensureTenantDomain for a live site,
 *   3. a daily cron (app/api/cron/website-domains) re-attaches every live site.
 * Every failure is logged with Vercel's error code (never the token).
 *
 * Degrades gracefully: without VERCEL_API_TOKEN / VERCEL_PROJECT_ID (local dev)
 * everything no-ops and reports `skipped`.
 */

const ROOT = "binaya.app";
const API = "https://api.vercel.com";

function config() {
  return {
    token: process.env.VERCEL_API_TOKEN,
    projectId: process.env.VERCEL_PROJECT_ID,
    teamId: process.env.VERCEL_TEAM_ID,
  };
}

export type ProvisionResult = { ok: boolean; skipped?: boolean; error?: string };

/** connected = attached + certificate-ready; pending = attached, DNS/cert not verified yet. */
export type DomainState = "connected" | "pending" | "missing" | "unknown" | "skipped";
export type DomainStatus = { state: DomainState; error?: string };

export function tenantHost(slug: string): string {
  return `${slug}.${ROOT}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Vercel API call with retries on network errors, 429 and 5xx. */
async function vercelFetch(path: string, init: RequestInit, attempts = 3): Promise<Response> {
  const { token, teamId } = config();
  const sep = path.includes("?") ? "&" : "?";
  const url = `${API}${path}${teamId ? `${sep}teamId=${teamId}` : ""}`;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
        cache: "no-store",
      });
      if (res.status !== 429 && res.status < 500) return res;
      lastErr = new Error(`vercel_http_${res.status}`);
      if (i === attempts - 1) return res;
    } catch (e) {
      lastErr = e;
    }
    await sleep(400 * 2 ** i);
  }
  throw lastErr instanceof Error ? lastErr : new Error("vercel_unreachable");
}

async function errorOf(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}));
  const code = body?.error?.code as string | undefined;
  const msg = body?.error?.message as string | undefined;
  if (res.status === 401 || res.status === 403 || code === "forbidden" || code === "invalid_token") {
    return `Vercel rejected the API token (${res.status}${code ? ` ${code}` : ""}) — check VERCEL_API_TOKEN in the project's Production env vars.`;
  }
  return msg ? `${msg}${code ? ` (${code})` : ""}` : `vercel_http_${res.status}`;
}

/** Register a hostname with the Vercel project so it routes + gets TLS (idempotent). */
export async function addProjectDomain(host: string): Promise<ProvisionResult> {
  const { token, projectId } = config();
  if (!token || !projectId) return { ok: true, skipped: true };
  try {
    const res = await vercelFetch(`/v10/projects/${projectId}/domains`, {
      method: "POST",
      body: JSON.stringify({ name: host }),
    });
    if (res.ok) return { ok: true };
    const body = await res.clone().json().catch(() => ({}));
    const code = body?.error?.code;
    // Already attached to this project → idempotent success.
    if (res.status === 409 || code === "domain_already_in_use" || code === "domain_already_exists") return { ok: true };
    const error = await errorOf(res);
    console.error("[provision] add domain failed", { host, status: res.status, code, error });
    return { ok: false, error };
  } catch (e) {
    const error = e instanceof Error ? e.message : "vercel_unreachable";
    console.error("[provision] add domain error", { host, error });
    return { ok: false, error };
  }
}

/** Register `{slug}.binaya.app` with the Vercel project so it routes + gets TLS. */
export const addTenantDomain = (slug: string) => addProjectDomain(tenantHost(slug));

type ProjectDomain = { verified?: boolean; verification?: { type: string; domain: string; value: string }[] };

/** Is the hostname attached to the project, and is it verified? */
export async function getProjectDomainStatus(host: string): Promise<DomainStatus & { verification?: ProjectDomain["verification"] }> {
  const { token, projectId } = config();
  if (!token || !projectId) return { state: "skipped" };
  try {
    const res = await vercelFetch(`/v9/projects/${projectId}/domains/${host}`, { method: "GET" }, 2);
    if (res.status === 404) return { state: "missing" };
    if (!res.ok) {
      const error = await errorOf(res);
      console.error("[provision] domain status failed", { host, status: res.status, error });
      return { state: "unknown", error };
    }
    const body = (await res.json().catch(() => ({}))) as ProjectDomain;
    return body.verified === false ? { state: "pending", verification: body.verification } : { state: "connected" };
  } catch (e) {
    const error = e instanceof Error ? e.message : "vercel_unreachable";
    console.error("[provision] domain status error", { host, error });
    return { state: "unknown", error };
  }
}

/** Does the hostname's DNS point at Vercel? (null = couldn't tell) */
export async function isDomainMisconfigured(host: string): Promise<boolean | null> {
  const { token, projectId } = config();
  if (!token || !projectId) return null;
  try {
    const res = await vercelFetch(`/v6/domains/${host}/config?projectIdOrName=${projectId}`, { method: "GET" }, 2);
    if (!res.ok) return null;
    const body = (await res.json().catch(() => ({}))) as { misconfigured?: boolean };
    return typeof body.misconfigured === "boolean" ? body.misconfigured : null;
  } catch {
    return null;
  }
}

/** Remove a hostname from the project. */
export async function removeProjectDomain(host: string): Promise<ProvisionResult> {
  const { token, projectId } = config();
  if (!token || !projectId) return { ok: true, skipped: true };
  try {
    const res = await vercelFetch(`/v9/projects/${projectId}/domains/${host}`, { method: "DELETE" });
    if (res.ok || res.status === 404) return { ok: true };
    return { ok: false, error: await errorOf(res) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "vercel_unreachable" };
  }
}

/** Is `{slug}.binaya.app` attached to the project, and is it verified? */
export const getTenantDomainStatus = (slug: string): Promise<DomainStatus> => getProjectDomainStatus(tenantHost(slug));

/** Attach the domain if it's missing; returns the resulting status. */
export async function ensureTenantDomain(slug: string): Promise<DomainStatus> {
  const status = await getTenantDomainStatus(slug);
  if (status.state !== "missing") return status;
  const added = await addTenantDomain(slug);
  if (!added.ok) return { state: "missing", error: added.error };
  return getTenantDomainStatus(slug);
}

/** Remove `{slug}.binaya.app` from the project (used if a slug changes). */
export const removeTenantDomain = (slug: string) => removeProjectDomain(tenantHost(slug));

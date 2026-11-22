import "server-only";
import { prisma } from "@/lib/prisma";
import { addProjectDomain, getProjectDomainStatus, isDomainMisconfigured } from "./provision";
import { dnsRecordsFor, type DnsRecord } from "./custom-domain-shared";

/**
 * Where a customer's custom domain stands, from Vercel's point of view:
 *   pending_dns          → attached, but the domain's DNS doesn't point at us yet (show `records`)
 *   pending_verification → Vercel needs a TXT record to prove ownership (show `verification`)
 *   active               → verified and correctly configured (HTTPS certificate issued by Vercel)
 *   error                → couldn't talk to Vercel / it refused (show `error`)
 */
export type CustomDomainStatus = {
  state: "pending_dns" | "pending_verification" | "active" | "error";
  host: string;
  /** DNS records to create at the customer's DNS provider */
  records: DnsRecord[];
  /** extra TXT record(s) Vercel asks for to prove ownership */
  verification?: DnsRecord[];
  error?: string;
};

/**
 * Check a custom domain (and attach it to the Vercel project if it isn't yet), then record
 * whether it's active on the site row. The caller invalidates the public-site cache.
 */
export async function checkCustomDomain(organizationId: string, host: string): Promise<CustomDomainStatus> {
  const records = dnsRecordsFor(host);
  const result = async (r: Omit<CustomDomainStatus, "host" | "records"> & { records?: DnsRecord[] }): Promise<CustomDomainStatus> => {
    await prisma.orgWebsite.updateMany({
      where: { organizationId, customDomain: host },
      data: { customDomainActive: r.state === "active" },
    });
    return { host, records, ...r };
  };

  let status = await getProjectDomainStatus(host);
  if (status.state === "skipped") return result({ state: "pending_dns" }); // no Vercel credentials (local dev)

  if (status.state === "missing") {
    const added = await addProjectDomain(host);
    if (!added.ok) return result({ state: "error", error: added.error });
    status = await getProjectDomainStatus(host);
  }
  if (status.state === "unknown" || status.state === "missing") return result({ state: "error", error: status.error });

  if (status.state === "pending") {
    const verification = (status.verification ?? []).map((v) => ({ type: "TXT" as const, name: v.domain, value: v.value }));
    return result({ state: "pending_verification", verification });
  }

  // attached + verified: is the DNS actually pointing at us? (unknown → not yet active, to be safe)
  const misconfigured = await isDomainMisconfigured(host);
  return result({ state: misconfigured === false ? "active" : "pending_dns" });
}

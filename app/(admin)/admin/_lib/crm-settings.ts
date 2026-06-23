import { prisma } from "@/lib/prisma";

export type CrmTargets = {
  id: string;
  targetVisits: number;
  targetDemos: number;
  targetInterested: number;
  targetSigned: number;
  targetActive: number;
  foundingSpots: number;
};

/**
 * The CRM goals are a single org-agnostic row (founder data, not tenant data).
 * Read-or-create the singleton so the dashboard + settings form always have
 * a row to work with.
 */
export async function getCrmSettings(): Promise<CrmTargets> {
  const existing = await prisma.crmSettings.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;
  return prisma.crmSettings.create({ data: {} });
}

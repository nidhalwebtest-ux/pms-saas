import { cache } from "react";
import { getSessionUser } from "@/lib/current-user";

export type OrgSummary = {
  id: string;
  name: string;
  currency: string;
  logo: string | null;
};

/**
 * Resolve the current user's organization summary. Shares the request-cached
 * session user, so this adds no extra getUser/DB hits.
 */
export const getCurrentOrg = cache(async (): Promise<OrgSummary | null> => {
  const dbUser = await getSessionUser();
  return dbUser?.organization ?? null;
});

export const getCurrentCurrency = cache(async (): Promise<string> => {
  const org = await getCurrentOrg();
  return org?.currency ?? "OMR";
});

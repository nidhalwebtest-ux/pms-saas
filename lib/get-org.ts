import { cache } from "react";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";

export type OrgSummary = {
  id: string;
  name: string;
  currency: string;
  logo: string | null;
};

/**
 * Resolve the current user's organization summary. Cached per request via
 * React.cache so multiple server components can call this without duplicate
 * DB hits.
 */
export const getCurrentOrg = cache(async (): Promise<OrgSummary | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const dbUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: {
      organization: {
        select: { id: true, name: true, currency: true, logo: true },
      },
    },
  });
  return dbUser?.organization ?? null;
});

export const getCurrentCurrency = cache(async (): Promise<string> => {
  const org = await getCurrentOrg();
  return org?.currency ?? "OMR";
});

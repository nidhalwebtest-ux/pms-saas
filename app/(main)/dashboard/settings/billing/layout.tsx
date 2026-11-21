import AccessDenied from "@/components/dashboard/AccessDenied";
import { getSessionAccess } from "@/lib/access";

/** Plan & billing: same audience as Settings → Organization (owners / org admins). */
export default async function BillingLayout({ children }: { children: React.ReactNode }) {
  const access = await getSessionAccess();
  if (!access?.canView("organization")) return <AccessDenied />;
  return <>{children}</>;
}

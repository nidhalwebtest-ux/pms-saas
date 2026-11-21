import AccessDenied from "@/components/dashboard/AccessDenied";
import { getSessionAccess } from "@/lib/access";

export default async function WebsiteRequestsLayout({ children }: { children: React.ReactNode }) {
  const access = await getSessionAccess();
  if (!access?.canView("reservations")) return <AccessDenied />;
  return <>{children}</>;
}

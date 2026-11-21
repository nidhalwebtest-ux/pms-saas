import AccessDenied from "@/components/dashboard/AccessDenied";
import { getSessionAccess } from "@/lib/access";

export default async function SalesTargetsSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getSessionAccess();
  if (!access?.canView("salesTargets")) return <AccessDenied />;
  return <>{children}</>;
}

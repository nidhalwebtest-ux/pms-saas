import AccessDenied from "@/components/dashboard/AccessDenied";
import { getSessionAccess } from "@/lib/access";

export default async function ReturnSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getSessionAccess();
  if (!access?.canView("settingsReturns")) return <AccessDenied />;
  return <>{children}</>;
}

import AccessDenied from "@/components/dashboard/AccessDenied";
import { getSessionAccess } from "@/lib/access";

export default async function BanksSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getSessionAccess();
  if (!access?.canView("banks")) return <AccessDenied />;
  return <>{children}</>;
}

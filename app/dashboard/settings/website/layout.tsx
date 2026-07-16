import AccessDenied from "@/components/dashboard/AccessDenied";
import { getSessionAccess } from "@/lib/access";

export default async function WebsiteSettingsLayout({ children }: { children: React.ReactNode }) {
  const access = await getSessionAccess();
  if (!access?.canView("settingsWebsite")) return <AccessDenied />;
  return <>{children}</>;
}

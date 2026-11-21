import AccessDenied from "@/components/dashboard/AccessDenied";
import { getSessionAccess } from "@/lib/access";

export default async function WhatsAppSettingsLayout({ children }: { children: React.ReactNode }) {
  const access = await getSessionAccess();
  if (!access?.canView("settingsWhatsapp")) return <AccessDenied />;
  return <>{children}</>;
}

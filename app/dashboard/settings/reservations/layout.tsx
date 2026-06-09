import AccessDenied from "@/components/dashboard/AccessDenied";
import { hasRole } from "@/lib/route-guard";

export default async function ReservationSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const allowed = await hasRole(["OWNER", "MANAGER"]);
  if (!allowed) return <AccessDenied />;
  return <>{children}</>;
}

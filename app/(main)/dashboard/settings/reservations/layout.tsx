import AccessDenied from "@/components/dashboard/AccessDenied";
import { getSessionAccess } from "@/lib/access";

export default async function ReservationSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getSessionAccess();
  if (!access?.canView("settingsReservations")) return <AccessDenied />;
  return <>{children}</>;
}

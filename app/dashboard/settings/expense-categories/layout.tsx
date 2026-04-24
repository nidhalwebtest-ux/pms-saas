import AccessDenied from "@/components/dashboard/AccessDenied";
import { hasRole } from "@/lib/route-guard";

export default async function ExpenseCategoriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const allowed = await hasRole(["OWNER", "MANAGER"]);
  if (!allowed) return <AccessDenied />;
  return <>{children}</>;
}

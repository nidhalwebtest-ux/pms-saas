import AccessDenied from "@/components/dashboard/AccessDenied";
import { getSessionAccess } from "@/lib/access";

export default async function ExpenseCategoriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getSessionAccess();
  if (!access?.canView("expenseCategories")) return <AccessDenied />;
  return <>{children}</>;
}

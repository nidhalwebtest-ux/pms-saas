import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import ExpenseCategoryManager from "./ExpenseCategoryManager";

export default async function ExpenseCategoriesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true, role: true },
  });
  if (!dbUser?.organizationId) redirect("/onboarding");
  if (!["OWNER", "MANAGER"].includes(dbUser.role)) redirect("/dashboard");

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/dashboard/settings" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expense Categories</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage expense categories for your organization</p>
        </div>
      </div>

      <ExpenseCategoryManager />
    </div>
  );
}

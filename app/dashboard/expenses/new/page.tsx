import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import SubmitExpenseForm from "./SubmitExpenseForm";

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true, role: true },
  });
  if (!dbUser?.organizationId) redirect("/onboarding");

  // Only OWNER + STAFF (receptionist) can submit
  if (!["OWNER", "STAFF"].includes(dbUser.role)) {
    redirect("/dashboard/expenses");
  }

  const properties = await prisma.property.findMany({
    where: { organizationId: dbUser.organizationId, isArchived: false },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  if (properties.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <h3 className="text-lg font-medium text-gray-900">Setup Required</h3>
        <p className="mt-1 text-sm text-gray-500">
          You need to add a building before you can submit expenses.
        </p>
      </div>
    );
  }

  const sp = await searchParams;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/dashboard/expenses" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Submit Expense</h1>
          <p className="text-sm text-gray-500 mt-0.5">تقديم مصروف — submit a new expense for approval</p>
        </div>
      </div>

      <SubmitExpenseForm
        properties={properties}
        defaultPropertyId={sp.propertyId || ""}
      />
    </div>
  );
}

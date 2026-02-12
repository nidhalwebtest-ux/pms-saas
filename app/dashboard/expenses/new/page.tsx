import ExpenseForm from "@/components/dashboard/ExpenseForm";
import { createClient } from "@/utils/supabase/server";
import { PrismaClient } from "@prisma/client";
import { redirect } from "next/navigation";

const prisma = new PrismaClient();

export default async function NewExpensePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  // Fetch Properties for the Searchable Select
  const properties = await prisma.property.findMany({
    where: { organizationId: dbUser?.organizationId! },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  if (properties.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center">
        <h3 className="text-lg font-medium text-gray-900">Setup Required</h3>
        <p className="mt-1 text-sm text-gray-500">
          You need to add a property before you can record expenses.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Record New Expense</h1>
        <p className="text-sm text-gray-500 mt-1">
          Log operating costs, utility bills, or maintenance fees.
        </p>
      </div>

      <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl p-6">
        {/* Pass data to the Client Component */}
        <ExpenseForm properties={properties} />
      </div>
    </div>
  );
}

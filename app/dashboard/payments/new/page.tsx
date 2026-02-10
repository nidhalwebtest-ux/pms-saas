import { createClient } from "@/utils/supabase/server";
import { PrismaClient } from "@prisma/client";
import { redirect } from "next/navigation";
import CustomerPaymentForm from "@/components/dashboard/CustomerPaymentForm";

const prisma = new PrismaClient();

export default async function NewPaymentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  // Fetch Tenants for the Searchable Select
  const tenants = await prisma.tenant.findMany({
    where: { organizationId: dbUser?.organizationId! },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { firstName: "asc" },
  });

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Accept Customer Payment
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Record a payment and apply it to open invoices or hold as a deposit.
        </p>
      </div>

      <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl p-6">
        <CustomerPaymentForm tenants={tenants} />
      </div>
    </div>
  );
}

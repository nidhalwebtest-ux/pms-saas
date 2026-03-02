import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/FormComponents";
import CustomerPaymentForm from "@/components/dashboard/CustomerPaymentForm";
import { prisma } from "@/lib/prisma";

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

  const tenants = await prisma.tenant.findMany({
    where: { organizationId: dbUser?.organizationId! },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { firstName: "asc" },
  });

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <PageHeader
        title="Accept Customer Payment"
        description="Record a payment and apply it to open invoices or hold as a deposit."
        listHref="/dashboard/payments"
      />
      <CustomerPaymentForm tenants={tenants} />
    </div>
  );
}

import { createClient } from "@/utils/supabase/server";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/FormComponents";
import CustomerPaymentForm from "@/components/dashboard/CustomerPaymentForm";
import { prisma } from "@/lib/prisma";

export default async function EditPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  // Fetch the payment
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { tenant: true },
  });

  // Security check: Verify via Tenant
  if (!payment || payment.tenant.organizationId !== dbUser?.organizationId) {
    notFound();
  }

  // 🟢 FIX: Serialize the Decimal amount to a Number before passing it to the Client Component
  const serializedPayment = {
    ...payment,
    amount: Number(payment.amount), // Convert Decimal to Number
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <PageHeader
        title="Edit Payment Metadata"
        description="Update dates, notes, or references. Amount and Tenant are locked for accounting integrity."
        listHref="/dashboard/payments"
      />

      {/* Pass an empty array for tenants since the dropdown is disabled in Edit mode */}
      <CustomerPaymentForm tenants={[]} initialData={serializedPayment} />
    </div>
  );
}

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import SmartPaymentForm from "./SmartPaymentForm";

export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ tenantId?: string; invoiceId?: string }>;
}) {
  const params = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
      {/* Back nav */}
      <div className="mb-5">
        <Link
          href="/dashboard/payments"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeftIcon className="h-4 w-4" /> Back to Payments
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Record Payment</h1>
        <p className="mt-1 text-sm text-gray-500">
          Search for a tenant and select invoices to pay, or pay a specific invoice.
        </p>
      </div>

      <SmartPaymentForm
        preselectedTenantId={params.tenantId}
        preselectedInvoiceId={params.invoiceId}
      />
    </div>
  );
}

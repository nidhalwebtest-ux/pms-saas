import { createPayment } from "../actions"; // Adjust path if needed
import {
  PageHeader,
  FormCard,
  FormInput,
  FormSelect,
  FormActions,
} from "@/components/ui/FormComponents";
import { PrismaClient } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

const prisma = new PrismaClient();

export default async function NewPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params; // 'id' here is the Reservation ID

  // Fetch basic info to show context (optional but good UX)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { tenant: true, unit: true },
  });

  if (!reservation) notFound();

  return (
    <div className="max-w-2xl mx-auto py-8">
      <PageHeader
        title="Record Payment"
        description={`Add a payment for ${reservation.tenant.firstName}'s lease of ${reservation.unit.name}.`}
      />

      <form action={createPayment}>
        <input type="hidden" name="reservationId" value={id} />

        <FormCard>
          {/* Amount & Date */}
          <FormInput
            name="amount"
            label="Amount Received (OMR)"
            type="number"
            step="0.01"
            placeholder="0.00"
            required
            colSpan="sm:col-span-3"
            defaultValue={Number(reservation.amount)} // Auto-fill with rent amount
          />
          <FormInput
            name="date"
            label="Date Received"
            type="date"
            required
            colSpan="sm:col-span-3"
            defaultValue={new Date().toISOString().split("T")[0]} // Today
          />

          {/* Details */}
          <FormSelect
            name="method"
            label="Payment Method"
            colSpan="sm:col-span-3"
            options={[
              { label: "Cash", value: "CASH" },
              { label: "Bank Transfer", value: "BANK_TRANSFER" },
              { label: "Card / POS", value: "CARD" },
              { label: "Cheque", value: "CHEQUE" },
            ]}
          />
          <FormInput
            name="reference"
            label="Reference No / Receipt ID"
            placeholder="e.g. TRX-998877"
            colSpan="sm:col-span-3"
          />

          {/* Notes */}
          <div className="col-span-full">
            <label
              htmlFor="notes"
              className="block text-sm font-medium leading-6 text-gray-900"
            >
              Internal Notes
            </label>
            <div className="mt-2">
              <textarea
                id="notes"
                name="notes"
                rows={3}
                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
              />
            </div>
          </div>
        </FormCard>

        <FormActions cancelHref={`/dashboard/reservations/${id}`} />
      </form>
    </div>
  );
}

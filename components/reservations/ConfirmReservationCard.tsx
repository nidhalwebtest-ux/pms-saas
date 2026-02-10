"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { confirmReservation } from "@/app/dashboard/reservations/actions"; // Import action

export default function ConfirmReservationCard({
  reservationId,
  frequency,
}: {
  reservationId: string;
  frequency: string;
}) {
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    const formData = new FormData();
    formData.append("reservationId", reservationId);

    startTransition(async () => {
      const result = await confirmReservation(formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Reservation confirmed! Invoices generated.");
      }
    });
  };

  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8">
      <div className="flex justify-between items-center">
        <div className="flex gap-3">
          <ExclamationTriangleIcon className="h-6 w-6 text-yellow-500" />
          <div>
            <h3 className="text-sm font-bold text-yellow-800">
              Reservation is Pending
            </h3>
            <p className="text-sm text-yellow-700 mt-1">
              This reservation is holding the dates but has no financial
              contract yet. Confirm it to generate the{" "}
              <strong>
                {frequency === "MONTHLY" ? "Monthly" : "Daily"} Invoices
              </strong>
              .
            </p>
          </div>
        </div>

        <button
          onClick={handleConfirm}
          disabled={isPending}
          className="bg-yellow-600 text-white px-4 py-2 rounded-md font-semibold text-sm hover:bg-yellow-700 shadow-sm whitespace-nowrap disabled:opacity-50"
        >
          {isPending ? "Processing..." : "Confirm & Generate Contract"}
        </button>
      </div>
    </div>
  );
}

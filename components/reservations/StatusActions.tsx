"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { updateReservationStatus } from "@/app/dashboard/reservations/actions";

interface StatusActionsProps {
  id: string;
  status: string;
}

type StatusKey = "CHECKED_IN" | "COMPLETED" | "CANCELLED";

export default function StatusActions({ id, status }: StatusActionsProps) {
  const t = useTranslations("reservations.statusActions");
  const [isPending, startTransition] = useTransition();

  const handleStatusChange = (newStatus: StatusKey) => {
    const formData = new FormData();
    formData.append("id", id);
    formData.append("status", newStatus);

    startTransition(async () => {
      const result = await updateReservationStatus(formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t(`markedAs.${newStatus}`));
      }
    });
  };

  return (
    <div className="mt-4 flex gap-3 md:ms-4 md:mt-0">
      {status === "CONFIRMED" && (
        <button
          onClick={() => handleStatusChange("CHECKED_IN")}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 shadow-sm disabled:opacity-50"
        >
          <CheckCircleIcon className="h-4 w-4" />
          {isPending ? t("updating") : t("checkIn")}
        </button>
      )}

      {status === "CHECKED_IN" && (
        <button
          onClick={() => handleStatusChange("COMPLETED")}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 shadow-sm disabled:opacity-50"
        >
          <CheckCircleIcon className="h-4 w-4" />
          {isPending ? t("updating") : t("completeCheckOut")}
        </button>
      )}

      {/* Cancel Button */}
      {["CONFIRMED", "PENDING"].includes(status) && (
        <button
          onClick={() => handleStatusChange("CANCELLED")}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-red-600 ring-1 ring-inset ring-red-300 hover:bg-red-50 shadow-sm disabled:opacity-50"
        >
          <XCircleIcon className="h-4 w-4" />
          {isPending ? t("cancelling") : t("cancel")}
        </button>
      )}
    </div>
  );
}

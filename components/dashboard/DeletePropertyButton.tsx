"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TrashIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { deleteProperty } from "@/app/dashboard/properties/actions";

interface Props {
  propertyId: string;
  propertyName: string;
  unitCount: number;
}

export default function DeletePropertyButton({ propertyId, propertyName, unitCount }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteProperty(propertyId);
      if (result?.error) {
        toast.error(result.error);
        setShowConfirm(false);
      } else {
        toast.success(`"${propertyName}" has been deleted.`);
        router.push("/dashboard/properties");
      }
    });
  };

  if (showConfirm) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 max-w-sm">
        <div className="flex items-start gap-3">
          <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">
              Delete &ldquo;{propertyName}&rdquo;?
            </p>
            <p className="mt-1 text-xs text-red-600">
              This will permanently delete this property
              {unitCount > 0 ? (
                <>
                  {" "}and its{" "}
                  <strong>{unitCount} unit{unitCount !== 1 ? "s" : ""}</strong>
                </>
              ) : null}
              . This action cannot be undone.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="inline-flex items-center rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {isPending ? "Deleting…" : "Yes, Delete Forever"}
              </button>
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={isPending}
                className="inline-flex items-center rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setShowConfirm(true)}
      className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-inset ring-red-200 hover:bg-red-50 hover:ring-red-300"
    >
      <TrashIcon className="h-4 w-4" />
      Delete Property
    </button>
  );
}
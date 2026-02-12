"use client"; // <--- This tells Next.js this runs in the browser

import { PrinterIcon } from "@heroicons/react/24/outline";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
    >
      <PrinterIcon className="h-4 w-4 text-gray-500" />
      Print Receipt
    </button>
  );
}

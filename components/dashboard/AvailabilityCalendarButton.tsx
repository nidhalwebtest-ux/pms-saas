"use client";

import { useState } from "react";
import { CalendarDaysIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { AvailabilityCalendar } from "./AvailabilityCalendar";

interface Property {
  id: string;
  name: string;
}

interface Props {
  properties: Property[];
  defaultPropertyId?: string;
}

export default function AvailabilityCalendarButton({ properties, defaultPropertyId }: Props) {
  const [open, setOpen] = useState(false);

  if (properties.length === 0) return null;

  return (
    <>
      {/* Fixed floating button — bottom-left */}
      <button
        onClick={() => setOpen(true)}
        title="Availability Calendar"
        className="fixed bottom-6 left-6 z-40 flex items-center gap-2 rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg ring-1 ring-blue-700 hover:bg-blue-700 transition-colors"
      >
        <CalendarDaysIcon className="h-5 w-5" />
        <span className="hidden sm:inline">Availability</span>
      </button>

      {/* Full-screen slide-over panel */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-gray-50">
          {/* Header bar */}
          <div className="flex items-center justify-between bg-white px-4 py-3 shadow-sm border-b border-gray-200 shrink-0">
            <div className="flex items-center gap-2">
              <CalendarDaysIcon className="h-5 w-5 text-blue-600" />
              <h2 className="text-base font-semibold text-gray-900">Availability Calendar</h2>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Calendar */}
          <div className="flex-1 overflow-auto p-4">
            <AvailabilityCalendar
              properties={properties}
              defaultPropertyId={defaultPropertyId}
            />
          </div>
        </div>
      )}
    </>
  );
}

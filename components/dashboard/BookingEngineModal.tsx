"use client";

import { useState, useMemo } from "react";
import { XMarkIcon, HomeModernIcon } from "@heroicons/react/24/outline";
import { DayPicker, DateRange } from "react-day-picker";
import "react-day-picker/dist/style.css"; // Ensure styles are loaded

type PropertyWithUnits = {
  id: string;
  name: string;
  units: {
    id: string;
    name: string;
    basePrice: number;
    reservations: { startDate: Date; endDate: Date; status: string }[]; // NEW: We need this data
  }[];
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  properties: PropertyWithUnits[];
  currentDateRange?: DateRange;
  currentUnitId?: string;
  onConfirm: (dates: DateRange, unitId: string) => void;
}

export default function BookingEngineModal({
  isOpen,
  onClose,
  properties,
  currentDateRange,
  currentUnitId,
  onConfirm,
}: Props) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    currentDateRange,
  );
  const [selectedUnit, setSelectedUnit] = useState<string | undefined>(
    currentUnitId,
  );

  // --- AVAILABILITY LOGIC ---
  const availableProperties = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return properties; // Show all if no dates selected

    const checkIn = dateRange.from;
    const checkOut = dateRange.to;

    return properties.map((prop) => {
      // Filter out units that have an overlapping reservation
      const availableUnits = prop.units.filter((unit) => {
        const hasOverlap = unit.reservations.some((res) => {
          if (res.status === "CANCELLED") return false;
          const resStart = new Date(res.startDate);
          const resEnd = new Date(res.endDate);
          // Overlap formula: (StartA < EndB) and (EndA > StartB)
          return checkIn < resEnd && checkOut > resStart;
        });
        return !hasOverlap; // Keep if NO overlap
      });

      return { ...prop, units: availableUnits };
    });
  }, [dateRange, properties]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (dateRange?.from && dateRange?.to && selectedUnit) {
      onConfirm(dateRange, selectedUnit);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/70 backdrop-blur-sm p-4 sm:p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Select Dates & Unit
            </h2>
            <p className="text-sm text-gray-500">
              Choose dates to see real-time availability.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Body: Two Columns */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          {/* Left Column: VERTICAL Calendar */}
          <div className="w-full lg:w-1/2 p-6 border-r border-gray-100 overflow-y-auto flex flex-col items-center bg-white">
            <h3 className="text-lg font-semibold text-gray-900 mb-6 w-full text-center">
              1. Select Duration
            </h3>

            {/* The Vertical react-day-picker */}
            <DayPicker
              mode="range"
              defaultMonth={dateRange?.from || new Date()}
              selected={dateRange}
              onSelect={(range) => {
                setDateRange(range);
                setSelectedUnit(undefined); // Reset unit selection if dates change
              }}
              numberOfMonths={2} // Show 2 months
              pagedNavigation
              showOutsideDays={false}
              disabled={{ before: new Date() }}
              className="mx-auto" // Center it
              classNames={{
                months: "flex flex-col space-y-8", // strictly vertical
                month: "space-y-4",
                caption:
                  "flex justify-center pt-1 relative items-center text-gray-900 font-bold text-lg",
                nav: "space-x-1 flex items-center",
                nav_button:
                  "h-8 w-8 bg-gray-100 p-0 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors",
                nav_button_previous: "absolute left-2",
                nav_button_next: "absolute right-2",
                table: "w-full border-collapse space-y-1",
                head_row: "flex justify-between w-full mb-2",
                head_cell:
                  "text-gray-500 rounded-md w-10 font-semibold text-[0.85rem] uppercase tracking-wider text-center",
                row: "flex w-full mt-2 justify-between",
                cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-blue-50 first:[&:has([aria-selected])]:rounded-l-full last:[&:has([aria-selected])]:rounded-r-full focus-within:relative focus-within:z-20",
                day: "h-10 w-10 p-0 font-medium text-gray-900 hover:bg-gray-100 rounded-full flex items-center justify-center transition-colors",
                day_selected:
                  "!bg-blue-600 !text-white font-bold hover:!bg-blue-700 shadow-md",
                day_today: "bg-gray-50 text-blue-600 font-bold",
                day_outside: "text-gray-300 opacity-50",
                day_disabled: "text-gray-200 opacity-40 cursor-not-allowed",
                day_range_middle:
                  "aria-selected:!bg-blue-50 aria-selected:!text-blue-900 aria-selected:!rounded-none",
                day_hidden: "invisible",
              }}
            />
          </div>

          {/* Right Column: AVAILABLE Units List */}
          <div className="w-full lg:w-1/2 p-6 bg-gray-50/50 overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              2. Select Available Unit
            </h3>

            {!dateRange?.from || !dateRange?.to ? (
              <div className="h-[60%] flex items-center justify-center text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl p-8 text-center bg-white">
                Select Check-In and Check-Out dates
                <br />
                to view available units.
              </div>
            ) : (
              <div className="space-y-6">
                {availableProperties.map((property) => (
                  <div
                    key={property.id}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
                  >
                    <div className="bg-gray-100 px-4 py-3 border-b border-gray-200 font-bold text-gray-800 text-sm flex justify-between items-center">
                      {property.name}
                      <span className="text-xs font-medium text-gray-500 bg-white px-2 py-1 rounded-full border border-gray-200">
                        {property.units.length} available
                      </span>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {property.units.length === 0 && (
                        <div className="p-6 text-sm text-gray-500 text-center italic bg-gray-50/50">
                          Fully booked for these dates.
                        </div>
                      )}
                      {property.units.map((unit) => (
                        <label
                          key={unit.id}
                          className={`flex items-center justify-between p-4 cursor-pointer hover:bg-blue-50 transition-all ${selectedUnit === unit.id ? "bg-blue-50 ring-2 ring-inset ring-blue-600" : ""}`}
                        >
                          <div className="flex items-center gap-4">
                            <input
                              type="radio"
                              name="bookingUnit"
                              value={unit.id}
                              checked={selectedUnit === unit.id}
                              onChange={() => setSelectedUnit(unit.id)}
                              className="h-5 w-5 border-gray-300 text-blue-600 focus:ring-blue-600"
                            />
                            <div>
                              <div className="font-semibold text-gray-900 flex items-center gap-2 text-base">
                                <HomeModernIcon className="h-5 w-5 text-gray-400" />
                                {unit.name}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-gray-900">
                              {Number(unit.basePrice).toFixed(3)}
                            </div>
                            <div className="text-xs text-gray-500 font-medium">
                              OMR / night
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-200 bg-white flex justify-end gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] relative z-10">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!dateRange?.from || !dateRange?.to || !selectedUnit}
            className="px-8 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
          >
            Confirm Selection
          </button>
        </div>
      </div>
    </div>
  );
}

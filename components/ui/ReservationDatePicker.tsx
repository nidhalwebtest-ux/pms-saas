"use client";

import * as React from "react";
import {
  addDays,
  addMonths,
  addYears,
  format,
  differenceInDays,
  startOfDay,
} from "date-fns";
import { DayPicker, DateRange } from "react-day-picker";
import { Popover, Transition } from "@headlessui/react";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import "react-day-picker/dist/style.css";

interface ReservationDatePickerProps {
  date: DateRange | undefined;
  setDate: (date: DateRange | undefined) => void;
  className?: string;
}

export default function ReservationDatePicker({
  date,
  setDate,
  className,
}: ReservationDatePickerProps) {
  // ... Keep your applyPreset and durationLabel logic exactly the same ...
  const applyPreset = (type: "1year" | "6months" | "1month" | "1week") => {
    const start = date?.from || startOfDay(new Date());
    let end: Date;
    switch (type) {
      case "1year":
        end = addYears(start, 1);
        break;
      case "6months":
        end = addMonths(start, 6);
        break;
      case "1month":
        end = addMonths(start, 1);
        break;
      case "1week":
        end = addDays(start, 7);
        break;
    }
    end = addDays(end, -1);
    setDate({ from: start, to: end });
  };

  const durationLabel = React.useMemo(() => {
    if (!date?.from || !date?.to) return null;
    const days = differenceInDays(date.to, date.from) + 1;
    if (days >= 360)
      return (
        <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full ml-2">
          ~1 Year
        </span>
      );
    if (days > 28)
      return (
        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full ml-2">
          {Math.floor(days / 30)} Months
        </span>
      );
    return (
      <span className="bg-gray-100 text-gray-700 text-xs font-bold px-2 py-0.5 rounded-full ml-2">
        {days} Nights
      </span>
    );
  }, [date]);

  return (
    <div className={cn("relative", className)}>
      <Popover className="relative">
        {({ open }) => (
          <>
            <Popover.Button
              className={cn(
                "flex w-full items-center justify-start rounded-md border bg-white px-3 py-2 text-sm text-left shadow-sm ring-1 ring-inset focus:ring-2 focus:ring-blue-600 focus:outline-none",
                open
                  ? "ring-blue-600 border-blue-600"
                  : "border-gray-300 text-gray-900",
                !date && "text-gray-500",
              )}
            >
              <CalendarDaysIcon
                className="mr-2 h-5 w-5 text-gray-400"
                aria-hidden="true"
              />
              <span className="flex-grow">
                {date?.from
                  ? date.to
                    ? `${format(date.from, "MMM dd, yyyy")} - ${format(date.to, "MMM dd, yyyy")}`
                    : format(date.from, "MMM dd, yyyy")
                  : "Select Move-in & Move-out dates"}
              </span>
              {durationLabel}
            </Popover.Button>

            <Transition
              as={React.Fragment}
              enter="transition ease-out duration-200"
              enterFrom="opacity-0 translate-y-1"
              enterTo="opacity-100 translate-y-0"
              leave="transition ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 translate-y-1"
            >
              {/* Removed max-height constraints to allow the vertical calendar to stretch naturally */}
              <Popover.Panel className="absolute left-0 z-50 mt-2 w-auto origin-top-left rounded-md bg-white shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none">
                {/* Presets Bar */}
                <div className="flex items-center gap-2 border-b bg-gray-50 px-4 py-3 overflow-x-auto rounded-t-md">
                  <span className="text-xs font-medium text-gray-500 whitespace-nowrap">
                    Quick Set:
                  </span>
                  <button
                    type="button"
                    onClick={() => applyPreset("1year")}
                    className="rounded border bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 whitespace-nowrap"
                  >
                    +1 Year
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("6months")}
                    className="rounded border bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 whitespace-nowrap"
                  >
                    +6 Mo
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("1month")}
                    className="rounded border bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 whitespace-nowrap"
                  >
                    +1 Mo
                  </button>
                </div>

                {/* Calendar */}
                <div className="p-4 overflow-y-auto max-h-[60vh]">
                  <DayPicker
                    mode="range"
                    defaultMonth={date?.from}
                    selected={date}
                    onSelect={setDate}
                    numberOfMonths={2}
                    pagedNavigation
                    showOutsideDays={false}
                    disabled={{ before: new Date() }}
                    classNames={{
                      months: "flex flex-col space-y-6", // strictly vertical stacked months
                      month: "space-y-4",
                      caption:
                        "flex justify-center pt-1 relative items-center text-gray-900 font-bold",
                      caption_label: "text-sm font-medium",
                      nav: "space-x-1 flex items-center",
                      nav_button:
                        "h-7 w-7 bg-transparent p-0 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded flex items-center justify-center",
                      nav_button_previous: "absolute left-1",
                      nav_button_next: "absolute right-1",
                      table: "w-full border-collapse",

                      // THE FIX IS HERE: Use 7-column grid for perfect alignment
                      head_row: "grid grid-cols-7 mb-2",
                      head_cell:
                        "text-gray-500 rounded-md font-medium text-[0.8rem] text-center w-full",
                      row: "grid grid-cols-7 mt-1",

                      cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-blue-50 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                      day: "h-9 w-full p-0 font-normal text-gray-900 hover:bg-gray-100 rounded-md flex items-center justify-center transition-colors",
                      day_selected:
                        "!bg-blue-600 !text-white font-bold hover:!bg-blue-700",
                      day_today: "bg-gray-100 text-blue-600 font-bold",
                      day_outside: "text-gray-300 opacity-50",
                      day_disabled:
                        "text-gray-300 opacity-40 cursor-not-allowed",
                      day_range_middle:
                        "aria-selected:!bg-blue-50 aria-selected:!text-blue-900 aria-selected:!rounded-none",
                      day_hidden: "invisible",
                    }}
                  />
                </div>
              </Popover.Panel>
            </Transition>
          </>
        )}
      </Popover>
    </div>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import SearchableSelect, {
  SelectOption,
} from "@/components/ui/SearchableSelect";
import {
  FormCard,
  FormInput,
  FormSelect,
  FormActions,
} from "@/components/ui/FormComponents";
import { createReservation } from "@/app/dashboard/reservations/actions";
import { calculatePeriod } from "@/utils/date-math";
import BookingEngineModal from "./BookingEngineModal";
import { DateRange } from "react-day-picker";
import {
  UserIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  HomeIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import TenantForm from "./TenantForm";

// ... keep your existing PropertyWithUnits and Tenant types ...

interface Props {
  properties: any[];
  tenants: any[];
}

export default function ReservationForm({
  properties,
  tenants: initialTenants,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // State
  const [tenantOptions, setTenantOptions] = useState<SelectOption[]>(
    initialTenants.map((t) => ({
      id: t.id,
      name: `${t.firstName} ${t.lastName}`,
    })),
  );
  const [selectedTenant, setSelectedTenant] = useState<SelectOption | null>(
    null,
  );
  const [isTenantModalOpen, setIsTenantModalOpen] = useState(false);
  const [frequency, setFrequency] = useState<"MONTHLY" | "DAILY" | "YEARLY">(
    "MONTHLY",
  );
  const [amount, setAmount] = useState<string>("");

  // Booking Engine State
  const [isBookingEngineOpen, setIsBookingEngineOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedUnitId, setSelectedUnitId] = useState<string | undefined>();

  // Helpers to display selected data
  const selectedUnit = useMemo(() => {
    for (const p of properties) {
      const u = p.units.find((u: any) => u.id === selectedUnitId);
      if (u) return { ...u, propertyName: p.name };
    }
    return null;
  }, [selectedUnitId, properties]);

  const calculation = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return null;
    const period = calculatePeriod(dateRange.from, dateRange.to, frequency);
    const rate = parseFloat(amount) || 0;
    const total = rate * period.quantity;
    return { period, total };
  }, [dateRange, frequency, amount]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    if (!selectedTenant?.id) return toast.error("Please select a tenant.");
    if (!selectedUnitId) return toast.error("Please select a unit.");
    if (!dateRange?.from || !dateRange?.to)
      return toast.error("Please select a duration.");

    formData.append("unitId", selectedUnitId);
    formData.append("startDate", dateRange.from.toISOString());
    formData.append("endDate", dateRange.to.toISOString());

    startTransition(async () => {
      const result = await createReservation(null, formData);

      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Reservation created successfully!");
        setTimeout(() => {
          // REDIRECT TO VIEW PAGE
          router.push(`/dashboard/reservations/${result?.id}`);
        }, 1000);
      }
    });
  };

  return (
    <>
      <form onSubmit={handleSubmit}>
        <FormCard>
          {/* Row 1: Tenant & Terms (3 Columns) */}
          <div className="col-span-full mb-2 border-b border-gray-100 pb-2">
            <h3 className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <UserIcon className="h-4 w-4" /> Client & Terms
            </h3>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium leading-6 text-gray-900 mb-2">
              Select Tenant
            </label>
            <SearchableSelect
              label=""
              options={tenantOptions}
              value={selectedTenant}
              onChange={setSelectedTenant}
              onAdd={() => setIsTenantModalOpen(true)}
            />
            <input
              type="hidden"
              name="tenantId"
              value={selectedTenant?.id || ""}
            />
          </div>

          <FormSelect
            name="frequency"
            label="Lease Frequency"
            colSpan="sm:col-span-2"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as any)}
            options={[
              { label: "Monthly (Long Term)", value: "MONTHLY" },
              { label: "Daily (Short Stay)", value: "DAILY" },
              { label: "Yearly", value: "YEARLY" },
            ]}
          />

          <FormInput
            label={`Agreed Rate (${frequency === "DAILY" ? "Per Night" : "Per Month"})`}
            name="amount"
            type="number"
            step="0.001"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            colSpan="sm:col-span-2"
            icon={
              <span className="text-gray-500 sm:text-sm font-bold">OMR</span>
            }
          />

          {/* Row 2: Inventory Engine (Take over full width) */}
          <div className="col-span-full pt-4 mt-2 border-t border-gray-100">
            <h3 className="text-sm font-medium text-gray-500 mb-4 flex items-center gap-2">
              <CalendarDaysIcon className="h-4 w-4" /> Dates & Inventory
            </h3>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
              {dateRange && selectedUnit ? (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-left">
                    <div className="font-semibold text-gray-900 text-lg flex items-center gap-2">
                      <HomeIcon className="h-5 w-5 text-gray-400" />
                      {selectedUnit.name}{" "}
                      <span className="text-sm font-normal text-gray-500">
                        in {selectedUnit.propertyName}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {dateRange.from?.toLocaleDateString()} &rarr;{" "}
                      {dateRange.to?.toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsBookingEngineOpen(true)}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
                  >
                    Change Selection
                  </button>
                </div>
              ) : (
                <>
                  <CalendarDaysIcon className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500 mb-4">
                    No dates or unit selected yet.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsBookingEngineOpen(true)}
                    className="px-6 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 shadow-sm"
                  >
                    Open Booking Engine
                  </button>
                </>
              )}
            </div>

            {/* Live Calculation Output */}
            {calculation && selectedUnit && (
              <div className="mt-4 bg-blue-50 border border-blue-100 rounded-md p-4">
                <div className="flex justify-between items-center text-sm text-blue-800">
                  <span>
                    <strong className="font-semibold">Duration: </strong>
                    {"exactDuration" in calculation.period
                      ? `${calculation.period.exactDuration} Nights`
                      : `${calculation.period.months} Months`}
                  </span>
                  <span className="text-lg font-bold">
                    {calculation.total.toLocaleString("en-OM", {
                      style: "currency",
                      currency: "OMR",
                    })}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Row 3: Extra Info (3 Columns) */}
          <div className="col-span-full pt-4 mt-2 border-t border-gray-100">
            <h3 className="text-sm font-medium text-gray-500 mb-4 flex items-center gap-2">
              <DocumentTextIcon className="h-4 w-4" /> Additional Details
            </h3>
          </div>

          <FormInput
            name="guests"
            label="Number of Guests"
            type="number"
            defaultValue="1"
            colSpan="sm:col-span-2"
          />

          <FormInput
            name="checkInTime"
            label="Expected Check-In Time"
            type="time"
            defaultValue="14:00"
            colSpan="sm:col-span-2"
          />

          <div className="sm:col-span-full">
            <label className="block text-sm font-medium leading-6 text-gray-900 mb-2">
              Internal Notes
            </label>
            <textarea
              name="notes"
              rows={3}
              className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
              placeholder="Any special requests or details..."
            />
          </div>
        </FormCard>

        <FormActions
          isPending={isPending}
          cancelHref="/dashboard/reservations"
          submitLabel="Create Reservation"
        />
      </form>

      {/* The Booking Engine Modal */}
      <BookingEngineModal
        isOpen={isBookingEngineOpen}
        onClose={() => setIsBookingEngineOpen(false)}
        properties={properties}
        currentDateRange={dateRange}
        currentUnitId={selectedUnitId}
        onConfirm={(dates, unitId) => {
          setDateRange(dates);
          setSelectedUnitId(unitId);
          // Auto-fill amount based on unit basePrice if amount is currently empty
          const p = properties.find((prop) =>
            prop.units.some((u: any) => u.id === unitId),
          );
          const u = p?.units.find((u: any) => u.id === unitId);
          if (u && !amount) {
            setAmount(u.basePrice.toString());
          }
        }}
      />
      {isTenantModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative animate-in zoom-in duration-200">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex justify-between items-center z-10">
              <h2 className="text-lg font-bold text-gray-900">
                Add Quick Tenant
              </h2>
              <button
                onClick={() => setIsTenantModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6">
              {/* Pass the onSuccess callback to handle the modal close and auto-select */}
              <TenantForm
                onSuccess={(newTenant) => {
                  const newOption = {
                    id: newTenant.id,
                    name: `${newTenant.firstName} ${newTenant.lastName}`,
                  };
                  setTenantOptions((prev) => [...prev, newOption]); // Add to dropdown
                  setSelectedTenant(newOption); // Auto-select it
                  setIsTenantModalOpen(false); // Close the modal
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

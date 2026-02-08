"use client";

import { useMemo, useState } from "react";
import SearchableSelect, {
  SelectOption,
} from "@/components/ui/SearchableSelect";
import CreateTenantModal from "@/app/dashboard/@modal/CreateTenantModal";
import {
  FormCard,
  FormInput,
  FormSelect,
  FormActions,
} from "@/components/ui/FormComponents";
import { createReservation } from "@/app/dashboard/reservations/actions"; // Ensure this path is correct
import ReservationDatePicker from "@/components/ui/ReservationDatePicker";
import { DateRange } from "react-day-picker";
import { calculatePeriod } from "@/utils/date-math";

type PropertyWithUnits = {
  id: string;
  name: string;
  units: {
    id: string;
    name: string;
    basePrice: number;
  }[];
};

type Tenant = {
  id: string;
  firstName: string;
  lastName: string;
};

interface Props {
  properties: PropertyWithUnits[];
  tenants: Tenant[];
}

export default function ReservationForm({
  properties,
  tenants: initialTenants,
}: Props) {
  // --- State for Searchable Selects ---
  // 1. Tenants (Dynamic, can add new ones)
  const [tenantOptions, setTenantOptions] = useState<SelectOption[]>(
    initialTenants.map((t) => ({
      id: t.id,
      name: `${t.firstName} ${t.lastName}`,
    })),
  );
  const [selectedTenant, setSelectedTenant] = useState<SelectOption | null>(
    null,
  );

  // 2. Properties (Static list from server)
  const propertyOptions = properties.map((p) => ({ id: p.id, name: p.name }));
  const [selectedProperty, setSelectedProperty] = useState<SelectOption | null>(
    null,
  );

  // 3. Units (Derived from selected property)
  const [selectedUnit, setSelectedUnit] = useState<SelectOption | null>(null);

  // --- Modal State ---
  const [isModalOpen, setIsModalOpen] = useState(false);

  // --- Derived Data ---
  // Find the full property object to get its units
  const activeProperty = properties.find((p) => p.id === selectedProperty?.id);

  const unitOptions =
    activeProperty?.units.map((u) => ({
      id: u.id,
      name: `${u.name} (Default: ${Number(u.basePrice).toFixed(2)} OMR)`,
    })) || [];

  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [frequency, setFrequency] = useState<"MONTHLY" | "DAILY" | "YEARLY">(
    "MONTHLY",
  );
  const [amount, setAmount] = useState<string>("");
  // --- REAL-TIME CALCULATION ---
  const calculation = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return null;

    // 1. Calculate Duration
    const period = calculatePeriod(dateRange.from, dateRange.to, frequency);

    // 2. Calculate Total Estimate
    const rate = parseFloat(amount) || 0;
    const total = rate * period.quantity;

    return { period, total };
  }, [dateRange, frequency, amount]);

  // --- Handlers ---
  const handleTenantCreated = (newTenant: any) => {
    const newOption = {
      id: newTenant.id,
      name: `${newTenant.firstName} ${newTenant.lastName}`,
    };
    setTenantOptions((prev) => [...prev, newOption]);
    setSelectedTenant(newOption); // Auto-select the new tenant
  };

  const handlePropertyChange = (option: SelectOption | null) => {
    setSelectedProperty(option);
    setSelectedUnit(null); // Reset unit when property changes
  };

  return (
    <>
      <form action={createReservation}>
        <FormCard>
          {/* 1. Tenant Selection (Searchable + Add Button) */}
          <div className="sm:col-span-4">
            <SearchableSelect
              label="Select Tenant"
              options={tenantOptions}
              value={selectedTenant}
              onChange={setSelectedTenant}
              onAdd={() => setIsModalOpen(true)}
              placeholder="Search or add new tenant..."
            />
            {/* Hidden Input for Server Action */}
            <input
              type="hidden"
              name="tenantId"
              value={selectedTenant?.id || ""}
            />
          </div>

          <div className="col-span-full border-t border-gray-100 my-4"></div>

          {/* 2. Property Selection (Searchable) */}
          <div className="sm:col-span-3">
            <SearchableSelect
              label="Filter Property"
              options={propertyOptions}
              value={selectedProperty}
              onChange={handlePropertyChange}
              placeholder="Search property..."
            />
          </div>

          {/* 3. Unit Selection (Searchable) */}
          <div className="sm:col-span-3">
            <SearchableSelect
              label="Select Unit / Room"
              options={unitOptions}
              value={selectedUnit}
              onChange={setSelectedUnit}
              placeholder={
                activeProperty ? "Select a unit..." : "Select a property first"
              }
            />
            {/* Hidden Input for Server Action */}
            <input type="hidden" name="unitId" value={selectedUnit?.id || ""} />
          </div>

          {/* 4. Dates & Financials */}
          <div className="col-span-full border-t border-gray-100 pt-6 mt-2">
            <h3 className="text-sm font-medium text-gray-500 mb-4">
              Contract Details
            </h3>
            <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <div className="sm:col-span-4">
                <label className="block text-sm font-medium leading-6 text-gray-900 mb-1">
                  Lease Duration
                </label>
                <ReservationDatePicker
                  date={dateRange}
                  setDate={setDateRange}
                />

                {/* Hidden Inputs to pass data to Server Action */}
                <input
                  type="hidden"
                  name="startDate"
                  value={dateRange?.from ? dateRange.from.toISOString() : ""}
                />
                <input
                  type="hidden"
                  name="endDate"
                  value={dateRange?.to ? dateRange.to.toISOString() : ""}
                />
              </div>

              <FormInput
                label="Agreed Price (OMR)"
                name="amount"
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 150.000"
                className="block w-full rounded-md border-0 py-1.5 pl-3 pr-12 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                colSpan="sm:col-span-3"
              />

              <FormSelect
                label="Payment Frequency"
                name="frequency"
                colSpan="sm:col-span-3"
                options={[
                  { label: "Monthly", value: "MONTHLY" },
                  { label: "Daily (Hotel)", value: "DAILY" },
                  { label: "Yearly", value: "YEARLY" },
                ]}
              />

              {/* --- CALCULATION SUMMARY BOX --- */}
              {calculation && (
                <div className="col-span-full bg-blue-50 border border-blue-100 rounded-md p-4 mt-2">
                  <h4 className="text-sm font-semibold text-blue-900">
                    Period Summary
                  </h4>
                  <div className="mt-2 flex flex-col sm:flex-row justify-between gap-4 text-sm text-blue-800">
                    {/* Duration Breakdown */}
                    <div>
                      <span className="font-medium">Duration: </span>

                      {"exactDuration" in calculation.period ? (
                        // Daily Logic
                        <span>{calculation.period.exactDuration} Nights</span>
                      ) : (
                        <span>
                          {/* Use optional chaining (?.) and fallback to 0 to satisfy TS */}
                          {calculation.period.months ?? 0} Months
                          {/* Only show days if they exist and are > 0 */}
                          {(calculation.period.extraDays ?? 0) > 0 &&
                            ` + ${calculation.period.extraDays} Days`}
                        </span>
                      )}
                    </div>

                    {/* Total Price Estimate */}
                    <div className="text-right">
                      <span className="font-medium">
                        Total Contract Value:{" "}
                      </span>
                      <span className="text-lg font-bold">
                        {calculation.total.toLocaleString("en-OM", {
                          style: "currency",
                          currency: "OMR",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </FormCard>

        <FormActions cancelHref="/dashboard/reservations" />
      </form>

      {/* Create Tenant Modal */}
      <CreateTenantModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleTenantCreated}
      />
    </>
  );
}

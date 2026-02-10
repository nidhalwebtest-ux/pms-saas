"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
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

  const [frequency, setFrequency] = useState<"MONTHLY" | "DAILY" | "YEARLY">(
    "MONTHLY",
  );
  const [amount, setAmount] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  // Find the full property object to get its units
  const activeProperty = properties.find((p) => p.id === selectedProperty?.id);
  const unitOptions =
    activeProperty?.units.map((u) => ({
      id: u.id,
      name: `${u.name} (Default: ${Number(u.basePrice).toFixed(2)} OMR)`,
    })) || [];

  // --- REAL-TIME CALCULATION ---
  const calculation = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return null;

    // Pass the selected frequency so math knows if it's Nights or Months
    const period = calculatePeriod(dateRange.from, dateRange.to, frequency);

    const rate = parseFloat(amount) || 0;
    // If Monthly: 1 Month * 130 = 130.
    // If Daily: 28 Days * 5 = 140.
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

  // New Submit Handler
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // Stop default browser reload

    // Create FormData from the form inputs
    const formData = new FormData(e.currentTarget);

    // Manually ensure our "Hidden Inputs" for React State (SearchableSelects) are valid
    if (!selectedTenant?.id) {
      toast.error("Please select a tenant.");
      return;
    }
    if (!selectedUnit?.id) {
      toast.error("Please select a unit.");
      return;
    }
    if (!dateRange?.from || !dateRange?.to) {
      toast.error("Please select a duration.");
      return;
    }

    startTransition(async () => {
      // Call the server action
      // Note: We pass 'null' as the first argument because we defined the action
      // to be compatible with useFormState (prevState), but here we call it directly.
      const result = await createReservation(null, formData);

      if (result?.error) {
        toast.error(result.error); // Display the error!
      } else {
        // Success is handled by the redirect in the action
        toast.success("Reservation created successfully! Redirecting...");
        setTimeout(() => {
          router.push("/dashboard/reservations");
        }, 3000);
      }
    });
  };

  return (
    <>
      <form onSubmit={handleSubmit}>
        <FormCard>
          {/* 1. Tenant */}
          <div className="sm:col-span-4">
            <SearchableSelect
              label="Select Tenant"
              options={tenantOptions}
              value={selectedTenant}
              onChange={setSelectedTenant}
              onAdd={() => setIsModalOpen(true)}
            />
            <input
              type="hidden"
              name="tenantId"
              value={selectedTenant?.id || ""}
            />
          </div>

          <div className="col-span-full border-t border-gray-100 my-4"></div>

          {/* 2. Property Selection */}
          <div className="sm:col-span-3">
            <SearchableSelect
              label="Filter Property"
              options={propertyOptions}
              value={selectedProperty}
              onChange={(val) => {
                setSelectedProperty(val);
                setSelectedUnit(null);
              }}
            />
          </div>
          <div className="sm:col-span-3">
            <SearchableSelect
              label="Select Unit / Room"
              options={unitOptions}
              value={selectedUnit}
              onChange={setSelectedUnit}
            />
            <input type="hidden" name="unitId" value={selectedUnit?.id || ""} />
          </div>

          {/* 3. Contract Details */}
          <div className="col-span-full border-t border-gray-100 pt-6 mt-2">
            <h3 className="text-sm font-medium text-gray-500 mb-4">
              Lease Terms
            </h3>

            <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              {/* FIX: MOVED FREQUENCY TO TOP */}
              <div className="sm:col-span-3">
                <label className="block text-sm font-medium leading-6 text-gray-900 mb-1">
                  Lease Frequency
                </label>
                <select
                  name="frequency"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as any)}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                >
                  <option value="MONTHLY">Monthly (Long Term)</option>
                  <option value="DAILY">Daily (Short Stay)</option>
                  <option value="YEARLY">Yearly</option>
                </select>
              </div>

              {/* Amount Input */}
              <div className="sm:col-span-3">
                <label className="block text-sm font-medium leading-6 text-gray-900 mb-1">
                  Agreed Rate (
                  {frequency === "DAILY" ? "Per Night" : "Per Month"})
                </label>
                <div className="relative mt-2 rounded-md shadow-sm">
                  <input
                    type="number"
                    name="amount"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="block w-full rounded-md border-0 py-1.5 pl-3 pr-12 text-gray-900 ring-1 ring-inset ring-gray-300"
                    placeholder={
                      frequency === "DAILY" ? "e.g. 25.000" : "e.g. 150.000"
                    }
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    <span className="text-gray-500 sm:text-sm">OMR</span>
                  </div>
                </div>
              </div>

              {/* Date Picker (Now Below Frequency) */}
              <div className="sm:col-span-4">
                <label className="block text-sm font-medium leading-6 text-gray-900 mb-1">
                  Duration
                </label>
                <ReservationDatePicker
                  date={dateRange}
                  setDate={setDateRange}
                />
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

              {/* --- CALCULATION SUMMARY BOX --- */}
              {calculation && (
                <div className="col-span-full bg-blue-50 border border-blue-100 rounded-md p-4 mt-2">
                  <div className="flex flex-col sm:flex-row justify-between gap-4 text-sm text-blue-800">
                    <div>
                      <span className="font-medium">Duration: </span>
                      {"exactDuration" in calculation.period ? (
                        <span>{calculation.period.exactDuration} Nights</span>
                      ) : (
                        <span>
                          {calculation.period.months} Months
                          {calculation.period.extraDays &&
                            calculation.period.extraDays > 0 &&
                            ` + ${calculation.period.extraDays} Days`}
                        </span>
                      )}
                    </div>

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
        <FormActions
          isPending={isPending}
          cancelHref="/dashboard/reservations"
        />
      </form>

      <CreateTenantModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={(t) => {
          const newOpt = { id: t.id, name: `${t.firstName} ${t.lastName}` };
          setTenantOptions((prev) => [...prev, newOpt]);
          setSelectedTenant(newOpt);
        }}
      />
    </>
  );
}

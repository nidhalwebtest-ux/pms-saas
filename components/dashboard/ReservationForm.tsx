"use client";

import { useState } from "react";
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
                placeholder="e.g. 150.000"
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

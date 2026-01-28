"use client";

import { useState } from "react";
import {
  FormCard,
  FormInput,
  FormSelect,
  FormActions,
} from "@/components/ui/FormComponents";
import { createReservation } from "@/app/dashboard/reservations/actions";

// Define the shape of data we need
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

export default function ReservationForm({
  properties,
  tenants,
}: {
  properties: PropertyWithUnits[];
  tenants: Tenant[];
}) {
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(
    properties[0]?.id || "",
  );

  // Filter units based on selection
  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);
  const availableUnits = selectedProperty ? selectedProperty.units : [];

  return (
    <form action={createReservation}>
      <FormCard>
        {/* 1. Tenant Selection */}
        <FormSelect
          label="Select Tenant"
          name="tenantId"
          colSpan="sm:col-span-4"
          options={tenants.map((t) => ({
            label: `${t.firstName} ${t.lastName}`,
            value: t.id,
          }))}
        />

        <div className="col-span-full border-t border-gray-100 my-4"></div>

        {/* 2. Unit Selection (The Logic) */}
        <div className="sm:col-span-3">
          <label className="block text-sm font-medium leading-6 text-gray-900">
            Filter Property
          </label>
          <select
            className="mt-2 block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
            value={selectedPropertyId}
            onChange={(e) => setSelectedPropertyId(e.target.value)}
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <FormSelect
          label="Select Unit / Room"
          name="unitId"
          colSpan="sm:col-span-3"
          options={availableUnits.map((u) => ({
            label: `${u.name} (Default: ${Number(u.basePrice).toFixed(2)} OMR)`,
            value: u.id,
          }))}
        />

        {/* 3. Dates & Financials */}
        <div className="col-span-full border-t border-gray-100 pt-6 mt-2">
          <h3 className="text-sm font-medium text-gray-500 mb-4">
            Contract Details
          </h3>
          <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
            <FormInput
              label="Start Date"
              name="startDate"
              type="date"
              required
              colSpan="sm:col-span-3"
            />
            <FormInput
              label="End Date"
              name="endDate"
              type="date"
              required
              colSpan="sm:col-span-3"
            />

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

      <FormActions cancelHref="/dashboard" />
    </form>
  );
}

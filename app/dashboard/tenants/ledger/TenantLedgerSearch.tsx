"use client";

import { useState, useRef } from "react";
import { Combobox } from "@headlessui/react";
import { ChevronUpDownIcon, CheckIcon, UserCircleIcon } from "@heroicons/react/24/outline";
import TenantLedger from "../[id]/TenantLedger";

interface TenantOption {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
}

interface Props {
  orgId: string;
  preselectedTenant: TenantOption | null;
}

export default function TenantLedgerSearch({ preselectedTenant }: Props) {
  const [query, setQuery]               = useState(
    preselectedTenant ? `${preselectedTenant.firstName} ${preselectedTenant.lastName}` : ""
  );
  const [results, setResults]           = useState<TenantOption[]>([]);
  const [selected, setSelected]         = useState<TenantOption | null>(preselectedTenant);
  const searchTimeout                   = useRef<ReturnType<typeof setTimeout>>();

  function onQueryChange(val: string) {
    setQuery(val);
    clearTimeout(searchTimeout.current);
    if (val.trim().length < 2) { setResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/tenants?search=${encodeURIComponent(val)}&limit=12`);
        const data = await res.json();
        setResults(data.tenants ?? []);
      } catch { /* ignore */ }
    }, 250);
  }

  function pickTenant(t: TenantOption | null) {
    setSelected(t);
    if (t) setQuery(`${t.firstName} ${t.lastName}`);
    else { setQuery(""); setResults([]); }
  }

  return (
    <div className="space-y-6">
      {/* Tenant Selector */}
      <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <UserCircleIcon className="h-4 w-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700">Select Tenant</h2>
        </div>
        <div className="px-5 py-4">
          <Combobox as="div" value={selected} onChange={pickTenant}>
            <div className="relative">
              <Combobox.Input
                className="w-full rounded-lg border-0 bg-white py-2.5 pl-4 pr-10 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm"
                displayValue={(t: TenantOption | null) =>
                  t ? `${t.firstName} ${t.lastName}` : ""
                }
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="Search tenant by name or phone…"
              />
              <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-3">
                <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
              </Combobox.Button>

              {results.length > 0 && (
                <Combobox.Options className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white py-1 shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm">
                  {results.map((t) => (
                    <Combobox.Option
                      key={t.id}
                      value={t}
                      className={({ active }) =>
                        `relative cursor-pointer select-none py-2.5 pl-4 pr-10 ${active ? "bg-blue-600 text-white" : "text-gray-900"}`
                      }
                    >
                      {({ active, selected: sel }) => (
                        <>
                          <div className="flex items-center justify-between gap-3">
                            <span className={`block truncate ${sel ? "font-semibold" : "font-normal"}`}>
                              {t.firstName} {t.lastName}
                            </span>
                            <span className={`text-xs ${active ? "text-blue-200" : "text-gray-400"}`}>
                              {t.phone}
                            </span>
                          </div>
                          {sel && (
                            <span className={`absolute inset-y-0 right-0 flex items-center pr-3 ${active ? "text-white" : "text-blue-600"}`}>
                              <CheckIcon className="h-4 w-4" />
                            </span>
                          )}
                        </>
                      )}
                    </Combobox.Option>
                  ))}
                </Combobox.Options>
              )}
            </div>
          </Combobox>

          {selected && (
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-blue-700">
                    {selected.firstName[0]}{selected.lastName[0]}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{selected.firstName} {selected.lastName}</p>
                  <p className="text-xs text-gray-500">{selected.phone}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => pickTenant(null)}
                className="text-xs text-gray-400 hover:text-red-600 transition-colors"
              >
                Change
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Ledger */}
      {selected ? (
        <TenantLedger
          tenantId={selected.id}
          tenantName={`${selected.firstName} ${selected.lastName}`}
        />
      ) : (
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 py-20 text-center">
          <UserCircleIcon className="mx-auto h-12 w-12 text-gray-200 mb-3" />
          <p className="text-sm font-medium text-gray-400">Select a tenant to view their ledger</p>
          <p className="text-xs text-gray-300 mt-1">Search by name or phone number above</p>
        </div>
      )}
    </div>
  );
}

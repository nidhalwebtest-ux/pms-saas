"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { BuildingLibraryIcon } from "@heroicons/react/24/outline";

interface BankOption {
  id: string;
  bankName: string;
  label: string | null;
  isActive: boolean;
  isDefault: boolean;
}

/**
 * Bank-account picker shown when a payment method routes to a bank
 * (transfer/card/cheque/online). Controlled: pass `value` + `onChange`.
 * Fetches the org's *active* accounts once. When `required` and no banks exist,
 * it links to Settings → Bank Accounts.
 */
export default function BankSelect({
  value,
  onChange,
  required = false,
  autoSelectDefault = true,
  className = "",
}: {
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
  autoSelectDefault?: boolean;
  className?: string;
}) {
  const t = useTranslations("payments.bank");
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/banks")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const active: BankOption[] = (d.banks ?? []).filter((b: BankOption) => b.isActive);
        setBanks(active);
        // Pre-select the default account for convenience.
        if (autoSelectDefault && !value) {
          const def = active.find((b) => b.isDefault) ?? active[0];
          if (def) onChange(def.id);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {t("label")}{required && <span className="text-red-500"> *</span>}
      </label>
      {loaded && banks.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <BuildingLibraryIcon className="h-4 w-4 flex-shrink-0" />
          <span>
            {t("noneYet")}{" "}
            <Link href="/dashboard/settings/banks" className="font-semibold underline">
              {t("addOne")}
            </Link>
          </span>
        </div>
      ) : (
        <div className="relative">
          <BuildingLibraryIcon className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required={required}
            className="w-full appearance-none rounded-lg border border-gray-300 bg-white ps-9 pe-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          >
            <option value="">{t("choose")}</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.bankName}{b.label ? ` — ${b.label}` : ""}{b.isDefault ? ` (${t("default")})` : ""}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

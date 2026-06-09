"use client";

import { ExclamationCircleIcon } from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";
import { Button } from "../../Button";
import type { TableErrorState } from "../types";

export interface DataTableErrorProps {
  state: TableErrorState;
  colspan: number;
}

/**
 * Error state — replaces the table body with an inline banner + optional
 * Retry button. Header / footer remain interactive so the user can try
 * different filters or pages.
 */
export function DataTableError({ state, colspan }: DataTableErrorProps) {
  const t = useTranslations("dataTable.error");
  return (
    <tr>
      <td colSpan={colspan} className="px-4 py-12">
        <div className="flex flex-col items-center justify-center gap-3 text-center">
          <ExclamationCircleIcon className="h-8 w-8 text-error-500" />
          <p className="text-sm text-fg max-w-md">{state.message}</p>
          {state.onRetry && (
            <Button size="sm" variant="secondary" onClick={state.onRetry}>
              {t("retry")}
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

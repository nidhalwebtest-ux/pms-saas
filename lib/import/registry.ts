import type { ImportRecordType } from "@prisma/client";
import type { ImportAdapter } from "./types";
import { buildingsAdapter } from "./adapters/buildings";
import { unitsAdapter } from "./adapters/units";
import { tenantsAdapter } from "./adapters/tenants";
import { expensesAdapter } from "./adapters/expenses";
import { reservationsAdapter } from "./adapters/reservations";

/* ============================================================================
 *  Adapter registry — dependency order matters: this array IS the order shown
 *  in Step 1 and used for the "import X first" warning.
 * ========================================================================= */

export const IMPORT_ADAPTERS: ImportAdapter<unknown>[] = [
  buildingsAdapter as ImportAdapter<unknown>,
  unitsAdapter as ImportAdapter<unknown>,
  tenantsAdapter as ImportAdapter<unknown>,
  expensesAdapter as ImportAdapter<unknown>,
  reservationsAdapter as ImportAdapter<unknown>,
];

export function getAdapter(recordType: ImportRecordType): ImportAdapter<unknown> {
  const adapter = IMPORT_ADAPTERS.find((a) => a.recordType === recordType);
  if (!adapter) throw new Error(`No import adapter registered for ${recordType}`);
  return adapter;
}

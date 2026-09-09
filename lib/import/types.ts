import type { ImportRecordType } from "@prisma/client";

/* ============================================================================
 *  Import engine — shared types
 *
 *  One ImportAdapter<T> per record type (buildings, units, tenants,
 *  reservations, expenses). The wizard, validator, batch runner, error-file
 *  generator, and undo logic are all generic against this interface — see
 *  lib/import/engine.ts.
 * ========================================================================= */

export type FieldType = "string" | "number" | "decimal" | "date" | "enum" | "boolean";

export interface FieldSpec {
  /** Stable key used in fieldMapping JSON and validation messages. */
  key: string;
  /** i18n key under `dataImport.fields.<recordType>.<key>` for the label. */
  labelKey: string;
  required: boolean;
  type: FieldType;
  /** For type "enum" — allowed raw values (case-insensitive match attempted). */
  enumValues?: string[];
  /** Header aliases used for auto-mapping — English + Arabic, lowercased/trimmed at match time. */
  aliases: string[];
  /** Example values for the downloadable template (English template). */
  exampleEn: [string, string];
  /** Example values for the downloadable template (Arabic-header template). */
  exampleAr: [string, string];
}

/** Per-import options captured in Step 3. */
export interface ImportOptions {
  duplicateHandling: "skip" | "update" | "create";
  dateFormat: "auto" | "DMY" | "MDY";
}

export const DEFAULT_IMPORT_OPTIONS: ImportOptions = {
  duplicateHandling: "skip",
  dateFormat: "auto",
};

/** system field key → CSV column header (or null if unmapped). */
export type FieldMapping = Record<string, string | null>;

export interface ImportContext {
  organizationId: string;
  userId: string;
  options: ImportOptions;
  /** Resolved once per job and cached across rows (e.g. property name → id). */
  cache: Map<string, unknown>;
}

export interface RowError {
  field?: string;
  message: string;
}

export type ParsedRowResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: RowError[] };

export interface ImportAdapter<T> {
  recordType: ImportRecordType;
  /** i18n key for the record type's display name, template filename base, etc. */
  labelKey: string;
  fields: FieldSpec[];
  /** Dependency hint — record types that should be imported first. */
  dependsOn: ImportRecordType[];

  /** Live count of existing records for this org (Step 1 card). */
  countExisting(organizationId: string): Promise<number>;

  /** Turn one mapped raw CSV row into typed, normalized data, or field errors. Pure — no DB access. */
  parseRow(raw: Record<string, string>, mapping: FieldMapping, opts: ImportOptions): ParsedRowResult<T>;

  /** Validate a parsed row against the DB (FK resolution, duplicates, business rules). No writes. */
  validateRow(data: T, ctx: ImportContext): Promise<RowError[]>;

  /**
   * Create the entity via the SAME code path the UI uses (never a raw insert).
   * Runs inside the row's own transaction where applicable. Returns the new
   * entity's id for undo tracking.
   */
  createRow(data: T, ctx: ImportContext): Promise<{ id: string }>;

  /** Delete a previously-imported entity for undo. Throws if it has dependents. */
  undoRow(entityId: string, organizationId: string): Promise<void>;
}

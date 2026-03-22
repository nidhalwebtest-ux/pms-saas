import { cookies } from "next/headers";

export const PROPERTY_COOKIE = "pms_selected_property";

/** Reads the org-scoped property filter from the request cookie. Returns "" for "All". */
export async function getSelectedPropertyId(): Promise<string> {
  const jar = await cookies();
  return jar.get(PROPERTY_COOKIE)?.value ?? "";
}

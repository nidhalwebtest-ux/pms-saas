"use server";

import { cookies } from "next/headers";
import { PROPERTY_COOKIE } from "@/lib/selected-property";

/** Sets or clears the active property filter cookie. Called client-side; page refreshed after. */
export async function selectProperty(propertyId: string): Promise<void> {
  const jar = await cookies();
  if (propertyId) {
    jar.set(PROPERTY_COOKIE, propertyId, {
      path:    "/",
      maxAge:  60 * 60 * 24 * 30, // 30 days
      sameSite: "lax",
    });
  } else {
    jar.delete(PROPERTY_COOKIE);
  }
}

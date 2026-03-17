"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type ActionResponse = {
  error?: string;
  success?: boolean;
  id?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getOrgId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });
  return dbUser?.organizationId ?? null;
}

function parsePhotos(formData: FormData): string[] {
  try {
    const raw = formData.get("photos") as string;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─── CREATE ───────────────────────────────────────────────────────────────────

export async function createProperty(formData: FormData): Promise<ActionResponse> {
  const organizationId = await getOrgId();
  if (!organizationId) return { error: "Unauthorized" };

  const name = (formData.get("name") as string)?.trim();
  const type = formData.get("type") as string;
  const address = formData.get("address") as string;
  const city = formData.get("city") as string;
  const governorate = formData.get("governorate") as string;
  const isActive = formData.get("isActive") !== "false"; // default true
  const photos = parsePhotos(formData);

  if (!name || !type) return { error: "Name and Type are required fields." };

  try {
    const property = await prisma.property.create({
      data: { name, type: type as any, address, city, governorate, isActive, photos, organizationId },
    });

    revalidatePath("/dashboard/properties");
    return { success: true, id: property.id };
  } catch (err) {
    console.error(err);
    return { error: "Failed to create property. Please try again." };
  }
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export async function updateProperty(formData: FormData): Promise<ActionResponse> {
  const organizationId = await getOrgId();
  if (!organizationId) return { error: "Unauthorized" };

  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  const type = formData.get("type") as string;
  const address = formData.get("address") as string;
  const city = formData.get("city") as string;
  const governorate = formData.get("governorate") as string;
  const isActive = formData.get("isActive") !== "false";
  const photos = parsePhotos(formData);

  const existing = await prisma.property.findUnique({
    where: { id },
    select: { organizationId: true },
  });
  if (existing?.organizationId !== organizationId) return { error: "Unauthorized access to this property." };

  try {
    await prisma.property.update({
      where: { id },
      data: { name, type: type as any, address, city, governorate, isActive, photos },
    });

    revalidatePath("/dashboard/properties");
    revalidatePath(`/dashboard/properties/${id}`);
    return { success: true };
  } catch (err) {
    console.error(err);
    return { error: "Failed to update property." };
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function deleteProperty(propertyId: string): Promise<ActionResponse> {
  const organizationId = await getOrgId();
  if (!organizationId) return { error: "Unauthorized" };

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { organizationId: true },
  });
  if (!property) return { error: "Property not found." };
  if (property.organizationId !== organizationId) return { error: "Unauthorized." };

  // Block deletion if any unit has an active reservation
  const activeReservationCount = await prisma.reservation.count({
    where: {
      unit: { propertyId },
      status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
    },
  });

  if (activeReservationCount > 0) {
    return {
      error: `Cannot delete: this property has ${activeReservationCount} active reservation(s). Complete or cancel them first.`,
    };
  }

  try {
    // Cascade in schema handles units → reservations etc.
    await prisma.property.delete({ where: { id: propertyId } });
    revalidatePath("/dashboard/properties");
    return { success: true };
  } catch (err) {
    console.error(err);
    return { error: "Failed to delete property." };
  }
}
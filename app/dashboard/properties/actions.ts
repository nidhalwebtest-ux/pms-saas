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
  const address = (formData.get("address") as string)?.trim() || undefined;
  const cityRaw = (formData.get("city") as string) || "Salalah";
  const cityCustom = (formData.get("cityCustom") as string)?.trim();
  const city = cityRaw === "Other" ? (cityCustom || "Other") : cityRaw;
  const governorate = (formData.get("governorate") as string)?.trim() || "Dhofar";
  const totalFloorsRaw = formData.get("totalFloors") as string;
  const totalFloors = totalFloorsRaw ? parseInt(totalFloorsRaw, 10) : undefined;
  const description = (formData.get("description") as string)?.trim() || undefined;
  const isActive = formData.get("isActive") !== "false"; // default true
  const photos = parsePhotos(formData);

  if (!name || !type) return { error: "Name and Type are required fields." };

  try {
    const property = await prisma.property.create({
      data: { name, type: type as any, address, city, governorate, totalFloors, description, isActive, photos, organizationId },
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
  const address = (formData.get("address") as string)?.trim() || undefined;
  const cityRaw = (formData.get("city") as string) || "Salalah";
  const cityCustom = (formData.get("cityCustom") as string)?.trim();
  const city = cityRaw === "Other" ? (cityCustom || "Other") : cityRaw;
  const governorate = (formData.get("governorate") as string)?.trim() || "Dhofar";
  const totalFloorsRaw = formData.get("totalFloors") as string;
  const totalFloors = totalFloorsRaw ? parseInt(totalFloorsRaw, 10) : null;
  const description = (formData.get("description") as string)?.trim() || null;
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
      data: { name, type: type as any, address, city, governorate, totalFloors, description, isActive, photos },
    });

    revalidatePath("/dashboard/properties");
    revalidatePath(`/dashboard/properties/${id}`);
    return { success: true };
  } catch (err) {
    console.error(err);
    return { error: "Failed to update property." };
  }
}

// ─── QUICK UPDATE (inline edit: name + status only) ───────────────────────────

export async function quickUpdateProperty(formData: FormData): Promise<ActionResponse> {
  const organizationId = await getOrgId();
  if (!organizationId) return { error: "Unauthorized" };

  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  const isActive = formData.get("isActive") !== "false";

  if (!name) return { error: "Name is required." };

  const existing = await prisma.property.findUnique({
    where: { id },
    select: { organizationId: true },
  });
  if (existing?.organizationId !== organizationId) return { error: "Unauthorized." };

  await prisma.property.update({ where: { id }, data: { name, isActive } });
  revalidatePath("/dashboard/properties");
  return { success: true };
}

// ─── ARCHIVE (soft-delete) ────────────────────────────────────────────────────

export async function archiveProperty(propertyId: string): Promise<ActionResponse> {
  const organizationId = await getOrgId();
  if (!organizationId) return { error: "Unauthorized" };

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { organizationId: true, isArchived: true },
  });
  if (!property)                              return { error: "Property not found." };
  if (property.organizationId !== organizationId) return { error: "Unauthorized." };
  if (property.isArchived)                    return { error: "Property is already archived." };

  await prisma.property.update({
    where: { id: propertyId },
    data:  { isArchived: true, archivedAt: new Date(), isActive: false },
  });

  revalidatePath("/dashboard/properties");
  revalidatePath(`/dashboard/properties/${propertyId}`);
  return { success: true };
}

// ─── RESTORE ──────────────────────────────────────────────────────────────────

export async function restoreProperty(propertyId: string): Promise<ActionResponse> {
  const organizationId = await getOrgId();
  if (!organizationId) return { error: "Unauthorized" };

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { organizationId: true, isArchived: true },
  });
  if (!property)                              return { error: "Property not found." };
  if (property.organizationId !== organizationId) return { error: "Unauthorized." };
  if (!property.isArchived)                   return { error: "Property is not archived." };

  await prisma.property.update({
    where: { id: propertyId },
    data:  { isArchived: false, archivedAt: null },
  });

  revalidatePath("/dashboard/properties");
  revalidatePath(`/dashboard/properties/${propertyId}`);
  return { success: true };
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
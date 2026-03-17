"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type ActionResponse = {
  error?: string;
  success?: boolean;
  id?: string;
};

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

export async function createUnit(formData: FormData): Promise<ActionResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  const propertyId = formData.get("propertyId") as string;
  const name = (formData.get("name") as string)?.trim();
  const basePrice = parseFloat(formData.get("basePrice") as string);
  const floor = parseInt(formData.get("floor") as string) || 1;
  const bedrooms = parseInt(formData.get("bedrooms") as string) || 1;
  const bathrooms = parseInt(formData.get("bathrooms") as string) || 1;
  const status = (formData.get("status") as string) || "AVAILABLE";
  const photos = parsePhotos(formData);

  if (!propertyId || !name || isNaN(basePrice) || basePrice < 0) {
    return { error: "Property, Name, and a valid Base Price are required." };
  }

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { organizationId: true },
  });

  if (property?.organizationId !== dbUser?.organizationId) {
    return { error: "Unauthorized to add units to this property." };
  }

  try {
    const newUnit = await prisma.unit.create({
      data: {
        name,
        basePrice,
        floor,
        bedrooms,
        bathrooms,
        status: status as any,
        photos,
        propertyId,
      },
    });

    revalidatePath("/dashboard/units");
    revalidatePath(`/dashboard/properties/${propertyId}`);
    return { success: true, id: newUnit.id };
  } catch (err) {
    console.error(err);
    return { error: "Failed to create unit." };
  }
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export async function updateUnit(formData: FormData): Promise<ActionResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  const id = formData.get("id") as string;
  const propertyId = formData.get("propertyId") as string;
  const name = (formData.get("name") as string)?.trim();
  const basePrice = parseFloat(formData.get("basePrice") as string);
  const floor = parseInt(formData.get("floor") as string) || 1;
  const bedrooms = parseInt(formData.get("bedrooms") as string) || 1;
  const bathrooms = parseInt(formData.get("bathrooms") as string) || 1;
  const status = (formData.get("status") as string) || "AVAILABLE";
  const photos = parsePhotos(formData);

  if (!name || isNaN(basePrice) || basePrice < 0) {
    return { error: "Name and a valid Base Price are required." };
  }

  const existingUnit = await prisma.unit.findUnique({
    where: { id },
    include: { property: { select: { organizationId: true } } },
  });
  const targetProperty = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { organizationId: true },
  });

  if (
    existingUnit?.property.organizationId !== dbUser?.organizationId ||
    targetProperty?.organizationId !== dbUser?.organizationId
  ) {
    return { error: "Unauthorized access." };
  }

  try {
    await prisma.unit.update({
      where: { id },
      data: { name, basePrice, floor, bedrooms, bathrooms, propertyId, status: status as any, photos },
    });

    revalidatePath("/dashboard/units");
    revalidatePath(`/dashboard/properties/${propertyId}`);
    return { success: true, id };
  } catch (err) {
    console.error(err);
    return { error: "Failed to update unit." };
  }
}
"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type ActionResponse = {
  error?: string;
  success?: boolean;
  id?: string;
};

// --- CREATE ---
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
  const name = formData.get("name") as string;
  const basePrice = parseFloat(formData.get("basePrice") as string);
  const floor = parseInt(formData.get("floor") as string) || 1;
  const bedrooms = parseInt(formData.get("bedrooms") as string) || 1;
  const bathrooms = parseInt(formData.get("bathrooms") as string) || 1;

  if (!propertyId || !name || isNaN(basePrice)) {
    return { error: "Property, Name, and Base Price are required." };
  }

  // Security Check: Does this property belong to the user's org?
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
        propertyId,
      },
    });

    revalidatePath("/dashboard/units");
    revalidatePath(`/dashboard/properties/${propertyId}`);
    return { success: true, id: newUnit.id };
  } catch (error) {
    console.error(error);
    return { error: "Failed to create unit." };
  }
}

// --- UPDATE ---
export async function updateUnit(formData: FormData): Promise<ActionResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const id = formData.get("id") as string;
  const propertyId = formData.get("propertyId") as string;
  const name = formData.get("name") as string;
  const basePrice = parseFloat(formData.get("basePrice") as string);
  const floor = parseInt(formData.get("floor") as string) || 1;
  const bedrooms = parseInt(formData.get("bedrooms") as string) || 1;
  const bathrooms = parseInt(formData.get("bathrooms") as string) || 1;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  // Verify the unit and the new property belong to the organization
  const existingUnit = await prisma.unit.findUnique({
    where: { id },
    include: { property: true },
  });

  const newProperty = await prisma.property.findUnique({
    where: { id: propertyId },
  });

  if (
    existingUnit?.property.organizationId !== dbUser?.organizationId ||
    newProperty?.organizationId !== dbUser?.organizationId
  ) {
    return { error: "Unauthorized access." };
  }

  try {
    await prisma.unit.update({
      where: { id },
      data: { name, basePrice, floor, bedrooms, bathrooms, propertyId },
    });

    revalidatePath("/dashboard/units");
    revalidatePath(`/dashboard/units/${id}`);
    revalidatePath(`/dashboard/properties/${propertyId}`);
    return { success: true, id: id };
  } catch (error) {
    console.error(error);
    return { error: "Failed to update unit." };
  }
}

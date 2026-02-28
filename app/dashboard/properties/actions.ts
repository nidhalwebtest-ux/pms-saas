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
export async function createProperty(
  formData: FormData,
): Promise<ActionResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthorized" };

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  if (!dbUser?.organizationId) return { error: "Organization not found" };

  const name = formData.get("name") as string;
  const type = formData.get("type") as any;
  const address = formData.get("address") as string;
  const city = formData.get("city") as string;
  const governorate = formData.get("governorate") as string;

  if (!name || !type) return { error: "Name and Type are required fields." };

  try {
    const newProperty = await prisma.property.create({
      data: {
        name,
        type,
        address,
        city,
        governorate,
        organizationId: dbUser.organizationId,
      },
    });

    revalidatePath("/dashboard/properties");
    return { success: true, id: newProperty.id };
  } catch (error) {
    console.error(error);
    return { error: "Failed to create property. Please try again." };
  }
}

// --- UPDATE ---
export async function updateProperty(
  formData: FormData,
): Promise<ActionResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const type = formData.get("type") as any;
  const address = formData.get("address") as string;
  const city = formData.get("city") as string;
  const governorate = formData.get("governorate") as string;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  const existingProperty = await prisma.property.findUnique({
    where: { id },
    select: { organizationId: true },
  });

  if (existingProperty?.organizationId !== dbUser?.organizationId) {
    return { error: "Unauthorized access to this property" };
  }

  try {
    await prisma.property.update({
      where: { id },
      data: { name, type, address, city, governorate },
    });

    revalidatePath("/dashboard/properties");
    revalidatePath(`/dashboard/properties/${id}`);
    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: "Failed to update property." };
  }
}

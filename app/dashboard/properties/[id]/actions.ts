"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";

const prisma = new PrismaClient();

export async function createUnit(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 1. Extract Data
  const propertyId = formData.get("propertyId") as string;
  const name = formData.get("name") as string; // "Room 101" or "Apt 4B"
  const basePrice = parseFloat(formData.get("basePrice") as string);
  const floor = parseInt(formData.get("floor") as string) || 0;
  const bedrooms = parseInt(formData.get("bedrooms") as string) || 1;
  const bathrooms = parseInt(formData.get("bathrooms") as string) || 1;

  // 2. Security Check: Does this user's Org own this property?
  // (Prevents IDOR attacks where I try to add a unit to YOUR building)
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { organizationId: true },
  });

  if (property?.organizationId !== dbUser?.organizationId) {
    throw new Error("Unauthorized access to this property");
  }

  // 3. Create the Unit
  await prisma.unit.create({
    data: {
      name,
      basePrice,
      floor,
      bedrooms,
      bathrooms,
      propertyId,
    },
  });

  // 4. Refresh the page
  revalidatePath(`/dashboard/properties/${propertyId}`);
  redirect(`/dashboard/properties/${propertyId}`);
}

export async function updateUnit(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const unitId = formData.get("unitId") as string;
  const propertyId = formData.get("propertyId") as string; // Needed for redirect

  const name = formData.get("name") as string;
  const basePrice = parseFloat(formData.get("basePrice") as string);
  const floor = parseInt(formData.get("floor") as string);
  const bedrooms = parseInt(formData.get("bedrooms") as string);
  const bathrooms = parseInt(formData.get("bathrooms") as string);

  // Security Check (Verify Org owns the Property this unit belongs to)
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: { property: true },
  });

  if (unit?.property.organizationId !== dbUser?.organizationId) {
    throw new Error("Unauthorized");
  }

  // Update
  await prisma.unit.update({
    where: { id: unitId },
    data: { name, basePrice, floor, bedrooms, bathrooms },
  });

  revalidatePath(`/dashboard/properties/${propertyId}`);
  redirect(`/dashboard/properties/${propertyId}`);
}

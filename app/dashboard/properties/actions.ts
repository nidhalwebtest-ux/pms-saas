"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";

const prisma = new PrismaClient();

export async function createProperty(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // 1. Get the User's Organization ID
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  if (!dbUser?.organizationId) {
    // Should not happen if middleware is working, but safe to handle
    redirect("/onboarding");
  }

  // 2. Extract Data
  const name = formData.get("name") as string;
  const type = formData.get("type") as any;
  const address = formData.get("address") as string;
  const city = formData.get("city") as string;
  const governorate = formData.get("governorate") as string;

  // 3. Create Property linked to ORGANIZATION
  await prisma.property.create({
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
  redirect("/dashboard/properties");
}

export async function updateProperty(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = formData.get("id") as string; // We need the ID to know what to update
  const name = formData.get("name") as string;
  const type = formData.get("type") as any;
  const address = formData.get("address") as string;
  const city = formData.get("city") as string;
  const governorate = formData.get("governorate") as string;

  // Security Check: Verify ownership before update
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });
  const existingProperty = await prisma.property.findUnique({
    where: { id },
    select: { organizationId: true },
  });

  if (existingProperty?.organizationId !== dbUser?.organizationId) {
    throw new Error("Unauthorized");
  }

  // Update
  await prisma.property.update({
    where: { id },
    data: { name, type, address, city, governorate },
  });

  revalidatePath("/dashboard/properties");
  revalidatePath(`/dashboard/properties/${id}`);
  redirect(`/dashboard/properties/${id}`);
}

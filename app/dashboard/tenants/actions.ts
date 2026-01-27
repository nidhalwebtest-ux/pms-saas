"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";

const prisma = new PrismaClient();

// --- CREATE ---
export async function createTenant(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 1. Get Org ID
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  // 2. Extract Data
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const nationalId = formData.get("nationalId") as string;
  const nationality = formData.get("nationality") as string;

  // 3. Create Tenant linked to Organization
  await prisma.tenant.create({
    data: {
      firstName,
      lastName,
      email,
      phone,
      nationalId,
      nationality,
      organizationId: dbUser?.organizationId!,
    },
  });

  revalidatePath("/dashboard/tenants");
  redirect("/dashboard/tenants");
}

// --- UPDATE ---
export async function updateTenant(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = formData.get("id") as string;
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const nationalId = formData.get("nationalId") as string;
  const nationality = formData.get("nationality") as string;

  // Security: Verify ownership
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });
  const existingTenant = await prisma.tenant.findUnique({
    where: { id },
    select: { organizationId: true },
  });

  if (existingTenant?.organizationId !== dbUser?.organizationId) {
    throw new Error("Unauthorized");
  }

  // Update
  await prisma.tenant.update({
    where: { id },
    data: { firstName, lastName, email, phone, nationalId, nationality },
  });

  revalidatePath("/dashboard/tenants");
  redirect("/dashboard/tenants");
}

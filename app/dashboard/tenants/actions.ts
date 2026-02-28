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
export async function createTenant(
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

  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const nationalId = formData.get("nationalId") as string;
  const nationality = formData.get("nationality") as string;

  if (!firstName || !lastName || !phone) {
    return { error: "First Name, Last Name, and Phone are required." };
  }

  try {
    const newTenant = await prisma.tenant.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        nationalId,
        nationality,
        organizationId: dbUser.organizationId,
      },
    });

    revalidatePath("/dashboard/tenants");
    return { success: true, id: newTenant.id };
  } catch (error) {
    console.error(error);
    return { error: "Failed to create tenant. Please try again." };
  }
}

// --- UPDATE ---
export async function updateTenant(
  formData: FormData,
): Promise<ActionResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const id = formData.get("id") as string;
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const nationalId = formData.get("nationalId") as string;
  const nationality = formData.get("nationality") as string;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  const existingTenant = await prisma.tenant.findUnique({
    where: { id },
    select: { organizationId: true },
  });

  if (existingTenant?.organizationId !== dbUser?.organizationId) {
    return { error: "Unauthorized access to this tenant" };
  }

  try {
    await prisma.tenant.update({
      where: { id },
      data: { firstName, lastName, email, phone, nationalId, nationality },
    });

    revalidatePath("/dashboard/tenants");
    revalidatePath(`/dashboard/tenants/${id}`);
    return { success: true, id: id };
  } catch (error) {
    console.error(error);
    return { error: "Failed to update tenant." };
  }
}

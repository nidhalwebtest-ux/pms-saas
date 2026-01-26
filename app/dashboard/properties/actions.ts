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

"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";

const prisma = new PrismaClient();

export async function createProperty(formData: FormData) {
  // 1. Get the current logged-in user (The Landlord)
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  // 2. Extract data from the form
  const name = formData.get("name") as string;
  const type = formData.get("type") as any; // "RESIDENTIAL" | "HOTEL"
  const address = formData.get("address") as string;
  const city = formData.get("city") as string;
  const governorate = formData.get("governorate") as string;

  // 3. Insert into Database using Prisma
  await prisma.property.create({
    data: {
      name,
      type,
      address,
      city,
      governorate,
      ownerId: user.id, // This links the property to YOU
    },
  });

  // 4. Refresh the properties page and redirect
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

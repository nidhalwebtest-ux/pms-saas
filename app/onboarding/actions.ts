"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function createOrganization(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const companyName = formData.get("companyName") as string;

  // --- FIX START ---
  // Safety Check: Ensure the user exists in the public table.
  // If the SQL trigger failed, this fixes it instantly.
  await prisma.user.upsert({
    where: { id: user.id },
    update: {}, // If they exist, do nothing
    create: {
      id: user.id,
      email: user.email!,
      role: "OWNER",
      // We don't set organizationId yet, we do that next
    },
  });
  // --- FIX END ---

  // Now it is safe to create the Organization and connect the user
  await prisma.organization.create({
    data: {
      name: companyName,
      plan: "FREE",
      users: {
        connect: { id: user.id }, // Now this will definitely find the user!
      },
    },
  });

  redirect("/dashboard");
}

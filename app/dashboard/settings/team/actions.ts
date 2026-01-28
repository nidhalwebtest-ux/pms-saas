"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";

const prisma = new PrismaClient();

export async function addTeamMember(formData: FormData) {
  // 1. Verify the current user (The Manager)
  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!currentUser) redirect("/login");

  // Get current user's org
  const dbUser = await prisma.user.findUnique({
    where: { id: currentUser.id },
    select: { organizationId: true, role: true },
  });

  // Optional: Check permissions (Only Owners/Managers can add staff)
  if (dbUser?.role !== "OWNER" && dbUser?.role !== "MANAGER") {
    throw new Error("You do not have permission to add users.");
  }

  // 2. Extract Data for the NEW user
  const firstName = formData.get("firstName") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const role = formData.get("role") as any;

  // 3. Create Auth User (Using Admin Client)
  const supabaseAdmin = createAdminClient();

  const { data: newAuthUser, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm their email so they can login immediately
    });

  if (authError) {
    throw new Error(authError.message);
  }

  if (!newAuthUser.user) throw new Error("Failed to create user");

  // 4. Create Public User Record (Linked to YOUR Org)
  await prisma.user.create({
    data: {
      id: newAuthUser.user.id, // IMPORTANT: Link the IDs
      email: email,
      firstName: firstName,
      role: role,
      organizationId: dbUser.organizationId!,
    },
  });

  revalidatePath("/dashboard/settings/team");
  redirect("/dashboard/settings/team");
}

"use server";

import { createClient } from "@/utils/supabase/server";
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const prisma = new PrismaClient();

export async function createExpense(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const title = formData.get("title") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const date = new Date(formData.get("date") as string);
  const category = formData.get("category") as any;
  const propertyId = formData.get("propertyId") as string;
  const description = formData.get("description") as string; // Optional detail

  // Security Check
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
  });

  if (property?.organizationId !== dbUser?.organizationId) {
    return { error: "Unauthorized" };
  }

  await prisma.expense.create({
    data: {
      title,
      amount,
      date,
      category,
      propertyId,
      // description: description // Add this to schema if you want long text
    },
  });

  revalidatePath("/dashboard/expenses");
  return { success: true };
}

export async function deleteExpense(formData: FormData) {
  const id = formData.get("id") as string;
  await prisma.expense.delete({ where: { id } });
  revalidatePath("/dashboard/expenses");
  redirect("/dashboard/expenses");
}

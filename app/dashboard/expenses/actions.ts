"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOrgUser, assertExpenseOwnership } from "@/lib/tenant";

export type ActionResponse = {
  error?: string;
  success?: boolean;
  id?: string;
};

// --- CREATE ---
export async function createExpense(
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

  const title = formData.get("title") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const date = new Date(formData.get("date") as string);
  const category = formData.get("category") as any;
  const propertyId = formData.get("propertyId") as string;
  const description = formData.get("description") as string;

  if (!title || !propertyId || isNaN(amount)) {
    return { error: "Description, Property, and Amount are required." };
  }

  // Security Check
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
  });

  if (property?.organizationId !== dbUser?.organizationId) {
    return { error: "Unauthorized access to this property" };
  }

  try {
    const newExpense = await prisma.expense.create({
      data: {
        title,
        amount,
        date,
        category,
        propertyId,
        // description: description // Uncomment if you add this to schema later
      },
    });

    revalidatePath("/dashboard/expenses");
    return { success: true, id: newExpense.id };
  } catch (error) {
    console.error(error);
    return { error: "Failed to record expense." };
  }
}

// --- UPDATE ---
export async function updateExpense(
  formData: FormData,
): Promise<ActionResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const id = formData.get("id") as string;
  const title = formData.get("title") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const date = new Date(formData.get("date") as string);
  const category = formData.get("category") as any;
  const propertyId = formData.get("propertyId") as string;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  // Verify ownership of the expense AND the new property
  const existingExpense = await prisma.expense.findUnique({
    where: { id },
    include: { property: true },
  });
  const newProperty = await prisma.property.findUnique({
    where: { id: propertyId },
  });

  if (
    existingExpense?.property.organizationId !== dbUser?.organizationId ||
    newProperty?.organizationId !== dbUser?.organizationId
  ) {
    return { error: "Unauthorized access." };
  }

  try {
    await prisma.expense.update({
      where: { id },
      data: { title, amount, date, category, propertyId },
    });

    revalidatePath("/dashboard/expenses");
    revalidatePath(`/dashboard/expenses/${id}`);
    return { success: true, id };
  } catch (error) {
    console.error(error);
    return { error: "Failed to update expense." };
  }
}

// --- DELETE ---
export async function deleteExpense(formData: FormData): Promise<void> {
  let orgUser;
  try { orgUser = await requireOrgUser(); } catch { return; }

  const id = formData.get("id") as string;
  try { await assertExpenseOwnership(id, orgUser.organizationId); } catch { return; }

  await prisma.expense.delete({ where: { id } });
  revalidatePath("/dashboard/expenses");
}

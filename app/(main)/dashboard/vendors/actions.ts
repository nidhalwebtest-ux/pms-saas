"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hasAccess } from "@/lib/access";
import { createClient } from "@/utils/supabase/server";

export type ActionResponse = { error?: string; success?: boolean; id?: string };

async function getActor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, organizationId: true },
  });
  return dbUser?.organizationId ? dbUser : null;
}

function parseVendorFields(fd: FormData) {
  const str = (k: string) => (fd.get(k) as string | null)?.trim() || null;
  const req = (k: string) => (fd.get(k) as string).trim();
  return {
    name:            req("name"),
    nameAr:          str("nameAr"),
    categoryId:      str("categoryId"),
    contactPerson:   str("contactPerson"),
    phone:           str("phone"),
    email:           str("email"),
    address:         str("address"),
    notes:           str("notes"),
    taxNumber:       str("taxNumber"),
    bankAccountName: str("bankAccountName"),
    bankName:        str("bankName"),
    accountNumber:   str("accountNumber"),
  };
}

export async function createVendor(fd: FormData): Promise<ActionResponse> {
  const actor = await getActor();
  if (!actor) return { error: "Unauthorized" };
  if (!(await hasAccess("vendors", "CREATE"))) return { error: "forbidden" };

  const fields = parseVendorFields(fd);
  if (!fields.name || fields.name.length < 2) return { error: "Name must be at least 2 characters." };

  if (fields.categoryId) {
    const cat = await prisma.expenseCat.findFirst({
      where: { id: fields.categoryId, organizationId: actor.organizationId!, isActive: true },
      select: { id: true },
    });
    if (!cat) return { error: "Invalid category." };
  }

  const vendor = await prisma.vendor.create({
    data: {
      ...fields,
      organizationId: actor.organizationId!,
    },
  });

  revalidatePath("/dashboard/vendors");
  return { success: true, id: vendor.id };
}

export async function updateVendor(fd: FormData): Promise<ActionResponse> {
  const actor = await getActor();
  if (!actor) return { error: "Unauthorized" };
  if (!(await hasAccess("vendors", "EDIT"))) return { error: "forbidden" };

  const id = (fd.get("id") as string)?.trim();
  const existing = await prisma.vendor.findUnique({
    where: { id }, select: { organizationId: true },
  });
  if (!existing || existing.organizationId !== actor.organizationId)
    return { error: "Unauthorized" };

  const fields = parseVendorFields(fd);
  if (!fields.name || fields.name.length < 2) return { error: "Name must be at least 2 characters." };

  if (fields.categoryId) {
    const cat = await prisma.expenseCat.findFirst({
      where: { id: fields.categoryId, organizationId: actor.organizationId!, isActive: true },
      select: { id: true },
    });
    if (!cat) return { error: "Invalid category." };
  }

  await prisma.vendor.update({
    where: { id },
    data: fields,
  });

  revalidatePath("/dashboard/vendors");
  revalidatePath(`/dashboard/vendors/${id}`);
  return { success: true, id };
}

export async function setVendorActive(id: string, isActive: boolean): Promise<ActionResponse> {
  const actor = await getActor();
  if (!actor) return { error: "Unauthorized" };
  if (!(await hasAccess("vendors", "EDIT"))) return { error: "forbidden" };

  const existing = await prisma.vendor.findUnique({
    where: { id }, select: { organizationId: true },
  });
  if (!existing || existing.organizationId !== actor.organizationId)
    return { error: "Unauthorized" };

  await prisma.vendor.update({ where: { id }, data: { isActive } });

  revalidatePath("/dashboard/vendors");
  revalidatePath(`/dashboard/vendors/${id}`);
  return { success: true, id };
}

/** Quick-create from the expense form's inline "create new vendor" flow. */
export async function quickCreateVendor(name: string): Promise<ActionResponse> {
  const actor = await getActor();
  if (!actor) return { error: "Unauthorized" };
  if (!(await hasAccess("vendors", "CREATE"))) return { error: "forbidden" };

  const trimmed = name.trim();
  if (trimmed.length < 2) return { error: "Name must be at least 2 characters." };

  const vendor = await prisma.vendor.create({
    data: { name: trimmed, organizationId: actor.organizationId! },
  });

  revalidatePath("/dashboard/vendors");
  return { success: true, id: vendor.id };
}

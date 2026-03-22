"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";

export type ActionResponse = { success?: boolean; error?: string; id?: string };

// ── Auth helper ───────────────────────────────────────────────────────────────

async function getOrgUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const dbUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { id: true, organizationId: true },
  });
  return dbUser?.organizationId ? dbUser : null;
}

async function assertUnitOrg(unitId: string, organizationId: string) {
  const unit = await prisma.unit.findUnique({
    where:   { id: unitId },
    include: { property: { select: { organizationId: true } } },
  });
  return unit?.property.organizationId === organizationId ? unit : null;
}

async function assertPriceOrg(priceId: string, organizationId: string) {
  const price = await prisma.unitPrice.findUnique({
    where:   { id: priceId },
    include: { unit: { include: { property: { select: { organizationId: true } } } } },
  });
  return price?.unit.property.organizationId === organizationId ? price : null;
}

// ── Pricing ───────────────────────────────────────────────────────────────────

export async function createDefaultPrice(formData: FormData): Promise<ActionResponse> {
  const actor = await getOrgUser();
  if (!actor) return { error: "Unauthorized" };

  const unitId = formData.get("unitId") as string;
  if (!await assertUnitOrg(unitId, actor.organizationId!)) return { error: "Unauthorized" };

  const existing = await prisma.unitPrice.findFirst({ where: { unitId, priceType: "DEFAULT" } });
  if (existing) return { error: "A default price already exists. Edit it instead." };

  const dailyRate   = parseFloat(formData.get("dailyRate")   as string);
  const monthlyRate = parseFloat(formData.get("monthlyRate") as string);
  const weeklyRaw   = formData.get("weeklyRate") as string;
  const weeklyRate  = weeklyRaw ? parseFloat(weeklyRaw) : undefined;

  if (isNaN(dailyRate) || dailyRate <= 0)   return { error: "Daily rate must be a positive number." };
  if (isNaN(monthlyRate) || monthlyRate <= 0) return { error: "Monthly rate must be a positive number." };

  const price = await prisma.unitPrice.create({
    data: { unitId, priceType: "DEFAULT", dailyRate, weeklyRate, monthlyRate, isActive: true },
  });

  revalidatePath(`/dashboard/units/${unitId}`);
  return { success: true, id: price.id };
}

export async function upsertDefaultPrice(formData: FormData): Promise<ActionResponse> {
  const actor = await getOrgUser();
  if (!actor) return { error: "Unauthorized" };

  const unitId  = formData.get("unitId")  as string;
  const priceId = formData.get("priceId") as string | null;

  if (!await assertUnitOrg(unitId, actor.organizationId!)) return { error: "Unauthorized" };

  const dailyRate   = parseFloat(formData.get("dailyRate")   as string);
  const monthlyRate = parseFloat(formData.get("monthlyRate") as string);
  const weeklyRaw   = formData.get("weeklyRate") as string;
  const weeklyRate  = weeklyRaw ? parseFloat(weeklyRaw) : null;

  if (isNaN(dailyRate) || dailyRate <= 0)    return { error: "Daily rate must be a positive number." };
  if (isNaN(monthlyRate) || monthlyRate <= 0) return { error: "Monthly rate must be a positive number." };

  let id: string;
  if (priceId) {
    if (!await assertPriceOrg(priceId, actor.organizationId!)) return { error: "Unauthorized" };
    await prisma.unitPrice.update({ where: { id: priceId }, data: { dailyRate, weeklyRate, monthlyRate } });
    id = priceId;
  } else {
    const created = await prisma.unitPrice.create({
      data: { unitId, priceType: "DEFAULT", dailyRate, weeklyRate, monthlyRate, isActive: true },
    });
    id = created.id;
  }

  revalidatePath(`/dashboard/units/${unitId}`);
  return { success: true, id };
}

export async function createSeasonalPrice(formData: FormData): Promise<ActionResponse> {
  const actor = await getOrgUser();
  if (!actor) return { error: "Unauthorized" };

  const unitId      = formData.get("unitId")      as string;
  const name        = (formData.get("name") as string)?.trim();
  const dailyRate   = parseFloat(formData.get("dailyRate")   as string);
  const monthlyRate = parseFloat(formData.get("monthlyRate") as string);
  const weeklyRaw   = formData.get("weeklyRate") as string;
  const weeklyRate  = weeklyRaw ? parseFloat(weeklyRaw) : null;
  const startDate   = new Date(formData.get("startDate") as string);
  const endDate     = new Date(formData.get("endDate")   as string);
  const priority    = parseInt(formData.get("priority")  as string) || 10;
  const isActive    = formData.get("isActive") !== "false";

  if (!name)  return { error: "Name is required." };
  if (!await assertUnitOrg(unitId, actor.organizationId!)) return { error: "Unauthorized" };
  if (isNaN(dailyRate) || dailyRate <= 0)    return { error: "Daily rate must be positive." };
  if (isNaN(monthlyRate) || monthlyRate <= 0) return { error: "Monthly rate must be positive." };
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return { error: "Invalid dates." };
  if (startDate >= endDate) return { error: "Start date must be before end date." };

  const price = await prisma.unitPrice.create({
    data: { unitId, priceType: "SEASONAL", name, dailyRate, weeklyRate, monthlyRate, startDate, endDate, priority, isActive },
  });

  revalidatePath(`/dashboard/units/${unitId}`);
  return { success: true, id: price.id };
}

export async function updateUnitPrice(formData: FormData): Promise<ActionResponse> {
  const actor = await getOrgUser();
  if (!actor) return { error: "Unauthorized" };

  const priceId = formData.get("priceId") as string;
  const price   = await assertPriceOrg(priceId, actor.organizationId!);
  if (!price) return { error: "Unauthorized" };

  const unitId      = price.unitId;
  const dailyRate   = parseFloat(formData.get("dailyRate")   as string);
  const monthlyRate = parseFloat(formData.get("monthlyRate") as string);
  const weeklyRaw   = formData.get("weeklyRate") as string;
  const weeklyRate  = weeklyRaw ? parseFloat(weeklyRaw) : null;

  if (isNaN(dailyRate) || dailyRate <= 0)    return { error: "Daily rate must be positive." };
  if (isNaN(monthlyRate) || monthlyRate <= 0) return { error: "Monthly rate must be positive." };

  const data: any = { dailyRate, weeklyRate, monthlyRate };

  if (price.priceType === "SEASONAL") {
    const name      = (formData.get("name") as string)?.trim();
    const startDate = new Date(formData.get("startDate") as string);
    const endDate   = new Date(formData.get("endDate")   as string);
    const priority  = parseInt(formData.get("priority")  as string) || 10;
    const isActive  = formData.get("isActive") !== "false";

    if (!name) return { error: "Name is required." };
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return { error: "Invalid dates." };
    if (startDate >= endDate) return { error: "Start date must be before end date." };

    Object.assign(data, { name, startDate, endDate, priority, isActive });
  }

  await prisma.unitPrice.update({ where: { id: priceId }, data });
  revalidatePath(`/dashboard/units/${unitId}`);
  return { success: true };
}

export async function deleteUnitPrice(priceId: string): Promise<ActionResponse> {
  const actor = await getOrgUser();
  if (!actor) return { error: "Unauthorized" };

  const price = await assertPriceOrg(priceId, actor.organizationId!);
  if (!price) return { error: "Unauthorized" };
  if (price.priceType === "DEFAULT") return { error: "Cannot delete the default price." };

  const unitId = price.unitId;
  await prisma.unitPrice.delete({ where: { id: priceId } });
  revalidatePath(`/dashboard/units/${unitId}`);
  return { success: true };
}

export async function toggleUnitPrice(priceId: string): Promise<ActionResponse> {
  const actor = await getOrgUser();
  if (!actor) return { error: "Unauthorized" };

  const price = await assertPriceOrg(priceId, actor.organizationId!);
  if (!price) return { error: "Unauthorized" };

  await prisma.unitPrice.update({ where: { id: priceId }, data: { isActive: !price.isActive } });
  revalidatePath(`/dashboard/units/${price.unitId}`);
  return { success: true };
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export async function addUnitNote(formData: FormData): Promise<ActionResponse> {
  const actor = await getOrgUser();
  if (!actor) return { error: "Unauthorized" };

  const unitId  = formData.get("unitId")  as string;
  const content = (formData.get("content") as string)?.trim();

  if (!content) return { error: "Note cannot be empty." };
  if (!await assertUnitOrg(unitId, actor.organizationId!)) return { error: "Unauthorized" };

  const note = await prisma.unitNote.create({
    data: { unitId, userId: actor.id, content },
  });

  revalidatePath(`/dashboard/units/${unitId}`);
  return { success: true, id: note.id };
}

export async function deleteUnitNote(noteId: string): Promise<ActionResponse> {
  const actor = await getOrgUser();
  if (!actor) return { error: "Unauthorized" };

  const note = await prisma.unitNote.findUnique({
    where:   { id: noteId },
    include: { unit: { include: { property: { select: { organizationId: true } } } } },
  });

  if (!note) return { error: "Note not found." };
  if (note.unit.property.organizationId !== actor.organizationId) return { error: "Unauthorized" };
  if (note.userId !== actor.id) return { error: "You can only delete your own notes." };

  await prisma.unitNote.delete({ where: { id: noteId } });
  revalidatePath(`/dashboard/units/${note.unitId}`);
  return { success: true };
}

"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type ActionResponse = {
  error?: string;
  success?: boolean;
  id?: string;
};

function parsePhotos(formData: FormData): string[] {
  try {
    const raw = formData.get("photos") as string;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseAmenities(formData: FormData): string[] {
  try {
    const raw = formData.get("amenities") as string;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─── CREATE ───────────────────────────────────────────────────────────────────

export async function createUnit(formData: FormData): Promise<ActionResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  const propertyId = formData.get("propertyId") as string;
  const name = (formData.get("name") as string)?.trim();
  const basePrice = parseFloat(formData.get("basePrice") as string);
  const floor = parseInt(formData.get("floor") as string) || 0;
  const bedrooms = parseInt(formData.get("bedrooms") as string) ?? 1;
  const bathrooms = parseInt(formData.get("bathrooms") as string) ?? 1;
  const unitType = (formData.get("unitType") as string) || "ONE_BR";
  const areaRaw = formData.get("area") as string;
  const area = areaRaw ? parseFloat(areaRaw) : undefined;
  const description = (formData.get("description") as string)?.trim() || undefined;
  const status = (formData.get("status") as string) || "AVAILABLE";
  const photos = parsePhotos(formData);
  const amenities = parseAmenities(formData);

  if (!propertyId || !name || isNaN(basePrice) || basePrice < 0) {
    return { error: "Property, Name, and a valid Base Price are required." };
  }

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { organizationId: true },
  });

  if (property?.organizationId !== dbUser?.organizationId) {
    return { error: "Unauthorized to add units to this property." };
  }

  try {
    const newUnit = await prisma.unit.create({
      data: {
        name,
        unitType,
        basePrice,
        floor,
        bedrooms,
        bathrooms,
        area,
        description,
        amenities,
        status: status as any,
        photos,
        propertyId,
      },
    });

    revalidatePath("/dashboard/units");
    revalidatePath(`/dashboard/properties/${propertyId}`);
    return { success: true, id: newUnit.id };
  } catch (err) {
    console.error(err);
    return { error: "Failed to create unit." };
  }
}

// ─── QUICK UPDATE (inline editing from list) ──────────────────────────────────

export async function quickUpdateUnit(formData: FormData): Promise<ActionResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id }, select: { organizationId: true },
  });

  const id   = formData.get("id")   as string;
  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Name is required." };

  const unit = await prisma.unit.findUnique({
    where:   { id },
    include: { property: { select: { organizationId: true } } },
  });
  if (!unit || unit.property.organizationId !== dbUser?.organizationId)
    return { error: "Unauthorized" };

  await prisma.unit.update({ where: { id }, data: { name } });
  revalidatePath("/dashboard/units");
  return { success: true };
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export async function updateUnit(formData: FormData): Promise<ActionResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  const id = formData.get("id") as string;
  const propertyId = formData.get("propertyId") as string;
  const name = (formData.get("name") as string)?.trim();
  const basePrice = parseFloat(formData.get("basePrice") as string);
  const floor = parseInt(formData.get("floor") as string) || 0;
  const bedrooms = parseInt(formData.get("bedrooms") as string) ?? 1;
  const bathrooms = parseInt(formData.get("bathrooms") as string) ?? 1;
  const unitType = (formData.get("unitType") as string) || "ONE_BR";
  const areaRaw = formData.get("area") as string;
  const area = areaRaw ? parseFloat(areaRaw) : null;
  const description = (formData.get("description") as string)?.trim() || null;
  const status = (formData.get("status") as string) || "AVAILABLE";
  const photos = parsePhotos(formData);
  const amenities = parseAmenities(formData);

  if (!name || isNaN(basePrice) || basePrice < 0) {
    return { error: "Name and a valid Base Price are required." };
  }

  const existingUnit = await prisma.unit.findUnique({
    where: { id },
    include: { property: { select: { organizationId: true } } },
  });
  const targetProperty = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { organizationId: true },
  });

  if (
    existingUnit?.property.organizationId !== dbUser?.organizationId ||
    targetProperty?.organizationId !== dbUser?.organizationId
  ) {
    return { error: "Unauthorized access." };
  }

  try {
    await prisma.unit.update({
      where: { id },
      data: { name, unitType, basePrice, floor, bedrooms, bathrooms, area, description, amenities, propertyId, status: status as any, photos },
    });

    revalidatePath("/dashboard/units");
    revalidatePath(`/dashboard/properties/${propertyId}`);
    return { success: true, id };
  } catch (err) {
    console.error(err);
    return { error: "Failed to update unit." };
  }
}

// ─── BULK CREATE ─────────────────────────────────────────────────────────────

interface BulkCreateInput {
  propertyId:         string;
  unitNames:          string[];
  unitType:           string;
  floor:              number;
  bedrooms:           number;
  bathrooms:          number;
  area:               number | null;
  basePrice:          number;
  amenities:          string[];
  createDefaultPrice: boolean;
  dailyRate:          number | null;
  weeklyRate:         number | null;
  monthlyRate:        number | null;
}

export async function bulkCreateUnits(
  input: BulkCreateInput,
): Promise<{ created: number; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { created: 0, error: "Unauthorized" };

  const dbUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { organizationId: true },
  });

  const property = await prisma.property.findUnique({
    where:  { id: input.propertyId },
    select: { organizationId: true },
  });

  if (!property || property.organizationId !== dbUser?.organizationId)
    return { created: 0, error: "Unauthorized" };

  const names = input.unitNames.filter((n) => n.trim());
  if (names.length === 0) return { created: 0, error: "No unit names provided." };
  if (names.length > 200) return { created: 0, error: "Maximum 200 units per batch." };

  // Use a transaction: create units, then optionally create default prices
  const result = await prisma.$transaction(async (tx) => {
    const created = await Promise.all(
      names.map((name) =>
        tx.unit.create({
          data: {
            name:        name.trim(),
            unitType:    input.unitType,
            floor:       input.floor,
            bedrooms:    input.bedrooms,
            bathrooms:   input.bathrooms,
            area:        input.area,
            basePrice:   input.basePrice,
            amenities:   input.amenities,
            propertyId:  input.propertyId,
            status:      "AVAILABLE",
          },
          select: { id: true },
        }),
      ),
    );

    if (input.createDefaultPrice && input.dailyRate && input.monthlyRate) {
      await tx.unitPrice.createMany({
        data: created.map((u) => ({
          unitId:      u.id,
          priceType:   "DEFAULT",
          dailyRate:   input.dailyRate!,
          weeklyRate:  input.weeklyRate,
          monthlyRate: input.monthlyRate!,
          isActive:    true,
        })),
      });
    }

    return created.length;
  });

  revalidatePath("/dashboard/units");
  revalidatePath(`/dashboard/properties/${input.propertyId}`);
  return { created: result };
}
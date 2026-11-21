"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hasAccess } from "@/lib/access";

export type ActionResponse = { error?: string; success?: boolean; id?: string };

// ── Auth helper ───────────────────────────────────────────────────────────────

async function getActor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const dbUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { id: true, organizationId: true },
  });
  return dbUser?.organizationId ? dbUser : null;
}

// ── Field extractor ───────────────────────────────────────────────────────────

function parseTenantFields(fd: FormData) {
  const str  = (k: string) => (fd.get(k) as string | null)?.trim() || null;
  const req  = (k: string) => (fd.get(k) as string).trim();
  const date = (k: string) => { const v = str(k); return v ? new Date(v) : null; };
  const tags = (): string[] => {
    try { const v = fd.get("tags_json"); return v ? JSON.parse(v as string) : []; }
    catch { return []; }
  };
  return {
    firstName:               req("firstName"),
    lastName:                req("lastName"),
    fullNameArabic:          str("fullNameArabic"),
    gender:                  str("gender"),
    dateOfBirth:             date("dateOfBirth"),
    nationality:             str("nationality"),
    idType:                  str("idType") ?? "national_id",
    idNumber:                str("idNumber"),
    idExpiryDate:            date("idExpiryDate"),
    idDocumentFront:         str("idDocumentFront"),
    idDocumentBack:          str("idDocumentBack"),
    phone:                   req("phone"),
    phoneSecondary:          str("phoneSecondary"),
    whatsappNumber:          str("whatsappNumber"),
    email:                   str("email"),
    country:                 str("country"),
    city:                    str("city"),
    addressLine:             str("addressLine"),
    emergencyContactName:    str("emergencyContactName"),
    emergencyContactPhone:   str("emergencyContactPhone"),
    emergencyContactRelation:str("emergencyContactRelation"),
    tenantType:              str("tenantType") ?? "individual",
    source:                  str("source") ?? "walk_in",
    classification:          str("classification") ?? "regular",
    corporateName:           str("corporateName"),
    corporateContact:        str("corporateContact"),
    preferredFloor:          str("preferredFloor"),
    preferredUnitType:       str("preferredUnitType"),
    preferredPaymentMethod:  str("preferredPaymentMethod"),
    specialRequests:         str("specialRequests"),
    internalNotes:           str("internalNotes"),
    tags:                    tags(),
  };
}

// ── CREATE ────────────────────────────────────────────────────────────────────

export async function createTenant(fd: FormData): Promise<ActionResponse> {
  const actor = await getActor();
  if (!actor) return { error: "Unauthorized" };
  if (!(await hasAccess("tenants", "CREATE"))) return { error: "forbidden" };

  const fields = parseTenantFields(fd);
  if (!fields.firstName || fields.firstName.length < 2) return { error: "First name must be at least 2 characters." };
  if (!fields.lastName  || fields.lastName.length < 2)  return { error: "Last name must be at least 2 characters." };
  if (!fields.phone)                                     return { error: "Phone is required." };
  if (!fields.idNumber)                                  return { error: "ID number is required." };
  if (!fields.nationality)                               return { error: "Nationality is required." };

  // Duplicate id_number check within org
  if (fields.idNumber) {
    const dup = await prisma.tenant.findFirst({
      where: { organizationId: actor.organizationId!, idNumber: fields.idNumber },
      select: { id: true },
    });
    if (dup) return { error: "A tenant with this ID number already exists." };
  }

  const tenant = await prisma.tenant.create({
    data: {
      ...fields,
      nationalId:     fields.idNumber, // keep legacy field in sync
      organizationId: actor.organizationId!,
      createdById:    actor.id,
    },
  });

  revalidatePath("/dashboard/tenants");
  return { success: true, id: tenant.id };
}

// ── UPDATE ────────────────────────────────────────────────────────────────────

export async function updateTenant(fd: FormData): Promise<ActionResponse> {
  const actor = await getActor();
  if (!actor) return { error: "Unauthorized" };
  if (!(await hasAccess("tenants", "EDIT"))) return { error: "forbidden" };

  const id = (fd.get("id") as string)?.trim();
  const existing = await prisma.tenant.findUnique({
    where: { id }, select: { organizationId: true },
  });
  if (!existing || existing.organizationId !== actor.organizationId)
    return { error: "Unauthorized" };

  const fields = parseTenantFields(fd);
  if (!fields.firstName || fields.firstName.length < 2) return { error: "First name must be at least 2 characters." };
  if (!fields.lastName  || fields.lastName.length < 2)  return { error: "Last name must be at least 2 characters." };
  if (!fields.phone)                                     return { error: "Phone is required." };

  // Duplicate check (exclude self)
  if (fields.idNumber) {
    const dup = await prisma.tenant.findFirst({
      where: { organizationId: actor.organizationId!, idNumber: fields.idNumber, NOT: { id } },
      select: { id: true },
    });
    if (dup) return { error: "Another tenant with this ID number already exists." };
  }

  await prisma.tenant.update({
    where: { id },
    data:  { ...fields, nationalId: fields.idNumber ?? undefined },
  });

  revalidatePath("/dashboard/tenants");
  revalidatePath(`/dashboard/tenants/${id}`);
  return { success: true, id };
}

// ── QUICK UPDATE (inline edit from list) ─────────────────────────────────────

export async function quickUpdateTenant(fd: FormData): Promise<ActionResponse> {
  const actor = await getActor();
  if (!actor) return { error: "Unauthorized" };
  if (!(await hasAccess("tenants", "EDIT"))) return { error: "forbidden" };

  const id = (fd.get("id") as string)?.trim();
  if (!id) return { error: "Missing ID" };

  const existing = await prisma.tenant.findUnique({
    where: { id }, select: { organizationId: true },
  });
  if (!existing || existing.organizationId !== actor.organizationId)
    return { error: "Unauthorized" };

  const firstName      = (fd.get("firstName")      as string | null)?.trim() || null;
  const lastName       = (fd.get("lastName")       as string | null)?.trim() || null;
  const phone          = (fd.get("phone")          as string | null)?.trim() || null;
  const classification = (fd.get("classification") as string | null)?.trim() || null;

  await prisma.tenant.update({
    where: { id },
    data: {
      ...(firstName      ? { firstName }      : {}),
      ...(lastName       ? { lastName }       : {}),
      ...(phone          ? { phone }          : {}),
      ...(classification ? { classification } : {}),
    },
  });

  revalidatePath("/dashboard/tenants");
  return { success: true, id };
}

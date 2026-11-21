"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSuperAdmin } from "@/lib/super-admin";

export type ActionResult = { ok: true; id?: string } | { error: string };

function str(v: FormDataEntryValue | null): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
function color(v: FormDataEntryValue | null): string {
  const s = typeof v === "string" ? v.trim() : "";
  return HEX.test(s) ? s : "#185FA5";
}

function revalidate() {
  revalidatePath("/admin/settings");
  revalidatePath("/admin/prospects");
  revalidatePath("/admin");
}

export async function createArea(fd: FormData): Promise<ActionResult> {
  if (!(await getSuperAdmin())) return { error: "Not authorized" };
  const name = str(fd.get("name"));
  if (!name) return { error: "Area name is required" };

  const last = await prisma.areaClassification.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const created = await prisma.areaClassification.create({
    data: {
      name,
      nameAr: str(fd.get("nameAr")),
      color: color(fd.get("color")),
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
    select: { id: true },
  });
  revalidate();
  return { ok: true, id: created.id };
}

export async function updateArea(fd: FormData): Promise<ActionResult> {
  if (!(await getSuperAdmin())) return { error: "Not authorized" };
  const id = str(fd.get("id"));
  if (!id) return { error: "Missing area id" };
  const name = str(fd.get("name"));
  if (!name) return { error: "Area name is required" };

  await prisma.areaClassification.update({
    where: { id },
    data: {
      name,
      nameAr: str(fd.get("nameAr")),
      color: color(fd.get("color")),
    },
  });
  revalidate();
  return { ok: true, id };
}

/** Delete an area. Prospects in it are detached (areaId → null) via onDelete: SetNull. */
export async function deleteArea(id: string): Promise<ActionResult> {
  if (!(await getSuperAdmin())) return { error: "Not authorized" };
  await prisma.areaClassification.delete({ where: { id } });
  revalidate();
  return { ok: true };
}

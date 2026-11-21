"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSuperAdmin } from "@/lib/super-admin";
import { QUESTION_CATEGORIES } from "../_lib/crm-options";

export type ActionResult = { ok: true; id?: string } | { error: string };

const MAX_QUESTION = 1000;
const MAX_TEXT = 10_000;

function str(v: FormDataEntryValue | null, max = MAX_TEXT): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s.slice(0, max);
}

function pickCategory(v: FormDataEntryValue | null): string {
  const s = typeof v === "string" ? v : "";
  return (QUESTION_CATEGORIES as readonly string[]).includes(s) ? s : "OTHER";
}

/** Resolve a submitted prospectId, dropping it to null if it doesn't exist. */
async function resolveProspectId(fd: FormData): Promise<string | null> {
  const raw = str(fd.get("prospectId"));
  if (!raw) return null;
  const exists = await prisma.prospect.findUnique({ where: { id: raw }, select: { id: true } });
  return exists ? raw : null;
}

function revalidate() {
  revalidatePath("/admin/questions");
}

async function readFields(fd: FormData) {
  const timesRaw = str(fd.get("timesAsked"));
  const timesAsked = timesRaw ? Math.max(1, Math.min(10_000, parseInt(timesRaw, 10) || 1)) : 1;
  return {
    question: str(fd.get("question"), MAX_QUESTION) ?? "",
    category: pickCategory(fd.get("category")) as never,
    answer: str(fd.get("answer")),
    notes: str(fd.get("notes")),
    timesAsked,
    prospectId: await resolveProspectId(fd),
  };
}

export async function createQuestion(fd: FormData): Promise<ActionResult> {
  if (!(await getSuperAdmin())) return { error: "Not authorized" };
  const data = await readFields(fd);
  if (!data.question) return { error: "Question is required" };
  const q = await prisma.leadQuestion.create({ data, select: { id: true } });
  revalidate();
  return { ok: true, id: q.id };
}

export async function updateQuestion(fd: FormData): Promise<ActionResult> {
  if (!(await getSuperAdmin())) return { error: "Not authorized" };
  const id = str(fd.get("id"));
  if (!id) return { error: "Missing id" };
  const data = await readFields(fd);
  if (!data.question) return { error: "Question is required" };
  await prisma.leadQuestion.update({ where: { id }, data });
  revalidate();
  return { ok: true, id };
}

/** "Asked again" — bump the counter and the last-asked date. */
export async function markAskedAgain(id: string): Promise<ActionResult> {
  if (!(await getSuperAdmin())) return { error: "Not authorized" };
  await prisma.leadQuestion.update({
    where: { id },
    data: { timesAsked: { increment: 1 }, lastAskedAt: new Date() },
  });
  revalidate();
  return { ok: true, id };
}

export async function deleteQuestion(id: string): Promise<ActionResult> {
  if (!(await getSuperAdmin())) return { error: "Not authorized" };
  await prisma.leadQuestion.delete({ where: { id } });
  revalidate();
  return { ok: true };
}

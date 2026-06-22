"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSuperAdmin } from "@/lib/super-admin";
import { computeScoring, normalizeScore, SCORE_FACTORS } from "@/utils/crm-scoring";
import {
  STAGES,
  INTERESTS,
  CONTACT_ROLES,
  AREAS,
  SOURCES,
  WHO_MET,
  CHANNELS,
} from "../_lib/crm-options";

export type ActionResult = { ok: true; id?: string } | { error: string };

/* ── helpers ─────────────────────────────────────────────────────────────── */

function pickEnum(v: FormDataEntryValue | null, allowed: readonly string[], fallback: string): string {
  const s = typeof v === "string" ? v : "";
  return allowed.includes(s) ? s : fallback;
}

function str(v: FormDataEntryValue | null): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}

function parseDate(v: FormDataEntryValue | null): Date | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function revalidate(prospectId?: string) {
  revalidatePath("/admin/prospects");
  revalidatePath("/admin/followups");
  revalidatePath("/admin");
  if (prospectId) revalidatePath(`/admin/prospects/${prospectId}`);
}

/** Extract + score the shared prospect fields from a form. */
function readProspectFields(fd: FormData) {
  const scores = Object.fromEntries(
    SCORE_FACTORS.map((f) => [f, normalizeScore(fd.get(f))]),
  ) as Record<(typeof SCORE_FACTORS)[number], number>;
  const { scoreTotal, tier } = computeScoring(scores);

  const estimatedRaw = str(fd.get("estimatedUnits"));
  const estimatedUnits = estimatedRaw != null ? Math.max(0, parseInt(estimatedRaw, 10) || 0) : null;

  const stage = pickEnum(fd.get("stage"), STAGES, "NOT_CONTACTED");

  return {
    businessName: str(fd.get("businessName")) ?? "",
    contactPersonName: str(fd.get("contactPersonName")),
    roleOfContact: pickEnum(fd.get("roleOfContact"), CONTACT_ROLES, "UNKNOWN") as never,
    phone: str(fd.get("phone")),
    area: pickEnum(fd.get("area"), AREAS, "OTHER") as never,
    addressNotes: str(fd.get("addressNotes")),
    source: pickEnum(fd.get("source"), SOURCES, "OTHER") as never,
    estimatedUnits,
    listedOnBooking: fd.get("listedOnBooking") === "on" || fd.get("listedOnBooking") === "true",
    websiteOrSocial: str(fd.get("websiteOrSocial")),
    ...scores,
    scoreTotal,
    tier,
    stage: stage as never,
    interestLevel: pickEnum(fd.get("interestLevel"), INTERESTS, "UNKNOWN") as never,
    mainPainNamed: str(fd.get("mainPainNamed")),
    nextFollowupDate: parseDate(fd.get("nextFollowupDate")),
    // lostReason only meaningful when LOST; clear it otherwise
    lostReason: stage === "LOST" ? str(fd.get("lostReason")) : null,
    notes: str(fd.get("notes")),
  };
}

/* ── Prospect CRUD ───────────────────────────────────────────────────────── */

export async function createProspect(fd: FormData): Promise<ActionResult> {
  if (!(await getSuperAdmin())) return { error: "Not authorized" };
  const data = readProspectFields(fd);
  if (!data.businessName) return { error: "Business name is required" };

  const created = await prisma.prospect.create({ data, select: { id: true } });
  revalidate(created.id);
  return { ok: true, id: created.id };
}

export async function updateProspect(fd: FormData): Promise<ActionResult> {
  if (!(await getSuperAdmin())) return { error: "Not authorized" };
  const id = str(fd.get("id"));
  if (!id) return { error: "Missing prospect id" };
  const data = readProspectFields(fd);
  if (!data.businessName) return { error: "Business name is required" };

  await prisma.prospect.update({ where: { id }, data });
  revalidate(id);
  return { ok: true, id };
}

export async function deleteProspect(id: string): Promise<ActionResult> {
  if (!(await getSuperAdmin())) return { error: "Not authorized" };
  await prisma.prospect.delete({ where: { id } }); // cascades visits + followups
  revalidate();
  return { ok: true };
}

/* ── Pipeline / detail quick-edits ───────────────────────────────────────── */

export async function updateStage(
  id: string,
  stage: string,
  lostReason?: string | null,
): Promise<ActionResult> {
  if (!(await getSuperAdmin())) return { error: "Not authorized" };
  const safeStage = (STAGES as readonly string[]).includes(stage) ? stage : "NOT_CONTACTED";
  await prisma.prospect.update({
    where: { id },
    data: {
      stage: safeStage as never,
      lostReason: safeStage === "LOST" ? (lostReason?.trim() || null) : null,
    },
  });
  revalidate(id);
  return { ok: true, id };
}

export async function updateInterest(id: string, interest: string): Promise<ActionResult> {
  if (!(await getSuperAdmin())) return { error: "Not authorized" };
  const safe = (INTERESTS as readonly string[]).includes(interest) ? interest : "UNKNOWN";
  await prisma.prospect.update({ where: { id }, data: { interestLevel: safe as never } });
  revalidate(id);
  return { ok: true, id };
}

export async function updateNotes(id: string, notes: string): Promise<ActionResult> {
  if (!(await getSuperAdmin())) return { error: "Not authorized" };
  await prisma.prospect.update({ where: { id }, data: { notes: notes.trim() || null } });
  revalidate(id);
  return { ok: true, id };
}

export async function updatePain(id: string, mainPainNamed: string): Promise<ActionResult> {
  if (!(await getSuperAdmin())) return { error: "Not authorized" };
  await prisma.prospect.update({
    where: { id },
    data: { mainPainNamed: mainPainNamed.trim() || null },
  });
  revalidate(id);
  return { ok: true, id };
}

export async function updateScores(id: string, fd: FormData): Promise<ActionResult> {
  if (!(await getSuperAdmin())) return { error: "Not authorized" };
  const scores = Object.fromEntries(
    SCORE_FACTORS.map((f) => [f, normalizeScore(fd.get(f))]),
  ) as Record<(typeof SCORE_FACTORS)[number], number>;
  const { scoreTotal, tier } = computeScoring(scores);
  await prisma.prospect.update({ where: { id }, data: { ...scores, scoreTotal, tier } });
  revalidate(id);
  return { ok: true, id };
}

/* ── Building photo + location ───────────────────────────────────────────── */

export async function updateBuildingPhoto(
  id: string,
  url: string | null,
): Promise<ActionResult> {
  if (!(await getSuperAdmin())) return { error: "Not authorized" };
  await prisma.prospect.update({ where: { id }, data: { buildingPhoto: url } });
  revalidate(id);
  return { ok: true, id };
}

export async function updateLocation(
  id: string,
  latitude: number | null,
  longitude: number | null,
): Promise<ActionResult> {
  if (!(await getSuperAdmin())) return { error: "Not authorized" };
  // Basic sanity-clamp; null clears the pin.
  const lat = latitude == null || isNaN(latitude) ? null : Math.max(-90, Math.min(90, latitude));
  const lng = longitude == null || isNaN(longitude) ? null : Math.max(-180, Math.min(180, longitude));
  await prisma.prospect.update({ where: { id }, data: { latitude: lat, longitude: lng } });
  revalidate(id);
  return { ok: true, id };
}

/* ── Visits ──────────────────────────────────────────────────────────────── */

/**
 * The playbook's suggested follow-up rhythm. Offsets in days from the visit.
 * Created as suggestions — fully editable/deletable, never forced.
 */
const RHYTHM: { offset: number; channel: string; purpose: string }[] = [
  { offset: 0, channel: "WHATSAPP", purpose: "Same-day thank-you + recap the pain we discussed" },
  { offset: 3, channel: "WHATSAPP", purpose: "Day 3 — answer questions, nudge toward a demo" },
  { offset: 7, channel: "CALL", purpose: "Day 7 — follow up on their decision" },
  { offset: 14, channel: "WHATSAPP", purpose: "Day 14 — re-engage, share a relevant win" },
  { offset: 30, channel: "VISIT", purpose: "Monthly — in-person touch-base" },
];

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

async function seedRhythmFor(prospectId: string, from: Date) {
  await prisma.prospectFollowup.createMany({
    data: RHYTHM.map((r) => ({
      prospectId,
      dueDate: addDays(from, r.offset),
      channel: r.channel as never,
      purpose: r.purpose,
    })),
  });
}

export async function logVisit(fd: FormData): Promise<ActionResult> {
  if (!(await getSuperAdmin())) return { error: "Not authorized" };
  const prospectId = str(fd.get("prospectId"));
  if (!prospectId) return { error: "Missing prospect id" };

  const visitDate = parseDate(fd.get("visitDate")) ?? new Date();
  const whoMet = pickEnum(fd.get("whoMet"), WHO_MET, "NOBODY");
  const advance = fd.get("advanceToVisited") === "on" || fd.get("advanceToVisited") === "true";
  const seedRhythm = fd.get("seedRhythm") === "on" || fd.get("seedRhythm") === "true";

  await prisma.prospectVisit.create({
    data: {
      prospectId,
      visitDate,
      whoMet: whoMet as never,
      outcomeNotes: str(fd.get("outcomeNotes")),
      objectionRaised: str(fd.get("objectionRaised")),
      nextAction: str(fd.get("nextAction")),
    },
  });

  // Optionally nudge a never-contacted prospect forward to VISITED.
  if (advance) {
    const p = await prisma.prospect.findUnique({ where: { id: prospectId }, select: { stage: true } });
    if (p?.stage === "NOT_CONTACTED") {
      await prisma.prospect.update({ where: { id: prospectId }, data: { stage: "VISITED" as never } });
    }
  }

  if (seedRhythm) await seedRhythmFor(prospectId, visitDate);

  revalidate(prospectId);
  return { ok: true, id: prospectId };
}

export async function deleteVisit(id: string, prospectId: string): Promise<ActionResult> {
  if (!(await getSuperAdmin())) return { error: "Not authorized" };
  await prisma.prospectVisit.delete({ where: { id } });
  revalidate(prospectId);
  return { ok: true };
}

/* ── Follow-ups ──────────────────────────────────────────────────────────── */

export async function seedFollowupRhythm(prospectId: string): Promise<ActionResult> {
  if (!(await getSuperAdmin())) return { error: "Not authorized" };
  await seedRhythmFor(prospectId, new Date());
  revalidate(prospectId);
  return { ok: true, id: prospectId };
}

export async function addFollowup(fd: FormData): Promise<ActionResult> {
  if (!(await getSuperAdmin())) return { error: "Not authorized" };
  const prospectId = str(fd.get("prospectId"));
  if (!prospectId) return { error: "Missing prospect id" };
  const dueDate = parseDate(fd.get("dueDate"));
  if (!dueDate) return { error: "A due date is required" };

  await prisma.prospectFollowup.create({
    data: {
      prospectId,
      dueDate,
      channel: pickEnum(fd.get("channel"), CHANNELS, "WHATSAPP") as never,
      purpose: str(fd.get("purpose")),
    },
  });
  revalidate(prospectId);
  return { ok: true, id: prospectId };
}

export async function toggleFollowup(
  id: string,
  prospectId: string,
  completed: boolean,
): Promise<ActionResult> {
  if (!(await getSuperAdmin())) return { error: "Not authorized" };
  await prisma.prospectFollowup.update({
    where: { id },
    data: { completed, completedDate: completed ? new Date() : null },
  });
  revalidate(prospectId);
  return { ok: true };
}

export async function deleteFollowup(id: string, prospectId: string): Promise<ActionResult> {
  if (!(await getSuperAdmin())) return { error: "Not authorized" };
  await prisma.prospectFollowup.delete({ where: { id } });
  revalidate(prospectId);
  return { ok: true };
}

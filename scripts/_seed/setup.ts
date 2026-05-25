/* ============================================================================
 *  Phase B: orgs, users, properties, units, seasonal pricing, expense cats.
 *
 *  Output shape — returned from runSetup() and threaded through later phases:
 *    {
 *      orgs:           [alNoor, salalahSuites]
 *      users:          [admin, manager, recept1, recept2, accountant, omar]
 *      properties:     [alNoorResidence, khareefSuites, salalahPlaza, salalahSuitesBuilding]
 *      units:          [{ id, name, propertyId, dailyRate, monthlyRate, ... }, ...]
 *      unitPrices:     <count, for the summary>
 *      expenseCats:    <count, for the summary>
 *    }
 * ========================================================================= */

import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/utils/supabase/admin";
import { KHAREEF_2025, KHAREEF_2026, EID_2026 } from "./dates";
import { NEIGHBOURHOODS } from "./omani-names";

/* ── Types returned to the orchestrator ─────────────────────────────────── */

export interface OrgRef {
  id: string;
  name: "Al Noor Property Management" | "Salalah Suites";
}

export interface UserRef {
  id: string;
  email: string;
  role: "OWNER" | "MANAGER" | "STAFF" | "ACCOUNTANT";
  organizationId: string;
}

export interface PropertyRef {
  id: string;
  name: string;
  organizationId: string;
  city: string;
}

export interface UnitRef {
  id: string;
  name: string;
  propertyId: string;
  organizationId: string;
  unitType: "STUDIO" | "ONE_BR" | "TWO_BR" | "THREE_BR" | "SUITE";
  dailyRate: number;
  monthlyRate: number;
}

export interface SetupResult {
  orgs: OrgRef[];
  users: UserRef[];
  properties: PropertyRef[];
  units: UnitRef[];
  unitPrices: number;
  expenseCats: number;
}

/* ── Test data definitions ──────────────────────────────────────────────── */

/* Unit-type pricing per the spec. Used both for the unit's `basePrice` and
 * for the DEFAULT UnitPrice row attached to it. */
const PRICE_TABLE: Record<UnitRef["unitType"], { daily: number; monthly: number }> = {
  STUDIO:    { daily:  40, monthly:  600 },
  ONE_BR:    { daily:  60, monthly:  800 },
  TWO_BR:    { daily:  90, monthly: 1200 },
  THREE_BR:  { daily: 130, monthly: 1600 },
  SUITE:     { daily: 180, monthly: 2200 },
};

/* Unit mix per the spec — 5 + 12 + 10 + 4 + 2 = 33 units for Al Noor. */
const AL_NOOR_UNIT_MIX: Array<{
  property: "Al Noor Residence" | "Khareef Suites" | "Salalah Plaza";
  type:    UnitRef["unitType"];
  floor:   number;
  name:    string;
}> = [
  // Al Noor Residence — 15 units
  { property: "Al Noor Residence", type: "STUDIO",   floor: 1, name: "101" },
  { property: "Al Noor Residence", type: "STUDIO",   floor: 1, name: "102" },
  { property: "Al Noor Residence", type: "STUDIO",   floor: 1, name: "103" },
  { property: "Al Noor Residence", type: "ONE_BR",   floor: 2, name: "201" },
  { property: "Al Noor Residence", type: "ONE_BR",   floor: 2, name: "202" },
  { property: "Al Noor Residence", type: "ONE_BR",   floor: 2, name: "203" },
  { property: "Al Noor Residence", type: "ONE_BR",   floor: 2, name: "204" },
  { property: "Al Noor Residence", type: "ONE_BR",   floor: 3, name: "301" },
  { property: "Al Noor Residence", type: "TWO_BR",   floor: 3, name: "302" },
  { property: "Al Noor Residence", type: "TWO_BR",   floor: 3, name: "303" },
  { property: "Al Noor Residence", type: "TWO_BR",   floor: 4, name: "401" },
  { property: "Al Noor Residence", type: "TWO_BR",   floor: 4, name: "402" },
  { property: "Al Noor Residence", type: "TWO_BR",   floor: 4, name: "403" },
  { property: "Al Noor Residence", type: "THREE_BR", floor: 5, name: "501" },
  { property: "Al Noor Residence", type: "SUITE",    floor: 5, name: "PH1" },

  // Khareef Suites — 10 units
  { property: "Khareef Suites", type: "STUDIO",   floor: 1, name: "K-101" },
  { property: "Khareef Suites", type: "STUDIO",   floor: 1, name: "K-102" },
  { property: "Khareef Suites", type: "ONE_BR",   floor: 2, name: "K-201" },
  { property: "Khareef Suites", type: "ONE_BR",   floor: 2, name: "K-202" },
  { property: "Khareef Suites", type: "ONE_BR",   floor: 2, name: "K-203" },
  { property: "Khareef Suites", type: "TWO_BR",   floor: 3, name: "K-301" },
  { property: "Khareef Suites", type: "TWO_BR",   floor: 3, name: "K-302" },
  { property: "Khareef Suites", type: "TWO_BR",   floor: 3, name: "K-303" },
  { property: "Khareef Suites", type: "THREE_BR", floor: 4, name: "K-401" },
  { property: "Khareef Suites", type: "SUITE",    floor: 4, name: "K-PH1" },

  // Salalah Plaza — 8 units
  { property: "Salalah Plaza", type: "ONE_BR",   floor: 1, name: "SP-101" },
  { property: "Salalah Plaza", type: "ONE_BR",   floor: 1, name: "SP-102" },
  { property: "Salalah Plaza", type: "ONE_BR",   floor: 1, name: "SP-103" },
  { property: "Salalah Plaza", type: "ONE_BR",   floor: 1, name: "SP-104" },
  { property: "Salalah Plaza", type: "TWO_BR",   floor: 2, name: "SP-201" },
  { property: "Salalah Plaza", type: "TWO_BR",   floor: 2, name: "SP-202" },
  { property: "Salalah Plaza", type: "TWO_BR",   floor: 2, name: "SP-203" },
  { property: "Salalah Plaza", type: "THREE_BR", floor: 3, name: "SP-301" },
];

/* Salalah Suites — 6 units for the multi-tenancy second org. */
const SALALAH_SUITES_UNITS: Array<{ type: UnitRef["unitType"]; floor: number; name: string }> = [
  { type: "STUDIO", floor: 1, name: "SS-101" },
  { type: "ONE_BR", floor: 1, name: "SS-102" },
  { type: "ONE_BR", floor: 2, name: "SS-201" },
  { type: "TWO_BR", floor: 2, name: "SS-202" },
  { type: "TWO_BR", floor: 3, name: "SS-301" },
  { type: "SUITE",  floor: 3, name: "SS-PH" },
];

/* System expense categories — created per org. */
const EXPENSE_CATEGORIES: Array<{ name: string; nameAr: string; icon: string }> = [
  { name: "Maintenance",    nameAr: "صيانة",        icon: "🔧" },
  { name: "Cleaning",       nameAr: "تنظيف",        icon: "🧹" },
  { name: "Supplies",       nameAr: "مستلزمات",     icon: "📦" },
  { name: "Utilities",      nameAr: "خدمات",        icon: "💡" },
  { name: "Transportation", nameAr: "نقل",          icon: "🚗" },
  { name: "Food",           nameAr: "طعام",         icon: "🍽️" },
  { name: "Other",          nameAr: "أخرى",         icon: "📋" },
];

/* ── Phase entry point ─────────────────────────────────────────────────── */

export async function runSetup(): Promise<SetupResult> {
  console.log("⚙︎  Phase B — orgs, users, properties, units, prices");

  /* ── B.1 — Organizations ──────────────────────────────────────────── */
  const alNoor = await prisma.organization.create({
    data: {
      name:    "Al Noor Property Management",
      phone:   "+968 2329 1100",
      address: "Al Haffa, Salalah",
      city:    "Salalah",
    },
  });
  const salalahSuites = await prisma.organization.create({
    data: {
      name:    "Salalah Suites",
      phone:   "+968 2329 2200",
      address: "Al Dahariz, Salalah",
      city:    "Salalah",
    },
  });
  console.log("   • 2 organizations");

  /* ── B.2 — Supabase auth users + Prisma User rows ────────────────── */
  const admin = createAdminClient();
  const users: UserRef[] = [];

  const userSpecs: Array<{ email: string; first: string; last: string; role: UserRef["role"]; orgId: string }> = [
    { email: "ahmed@alnoor.test",    first: "Ahmed",    last: "Al Balushi",  role: "OWNER",      orgId: alNoor.id },
    { email: "mansour@alnoor.test",  first: "Mansour",  last: "Al Habsi",    role: "MANAGER",    orgId: alNoor.id },
    { email: "fatima@alnoor.test",   first: "Fatima",   last: "Al Riyami",   role: "STAFF",      orgId: alNoor.id },
    { email: "sara@alnoor.test",     first: "Sara",     last: "Al Farsi",    role: "STAFF",      orgId: alNoor.id },
    { email: "khalid@alnoor.test",   first: "Khalid",   last: "Al Hashmi",   role: "ACCOUNTANT", orgId: alNoor.id },
    { email: "omar@salalah.test",    first: "Omar",     last: "Al Kindi",    role: "OWNER",      orgId: salalahSuites.id },
  ];

  for (const spec of userSpecs) {
    const { data, error } = await admin.auth.admin.createUser({
      email:        spec.email,
      password:     "Test1234!",
      email_confirm: true,
    });
    if (error) throw new Error(`Auth createUser(${spec.email}): ${error.message}`);
    const authId = data.user!.id;

    await prisma.user.create({
      data: {
        id:             authId,
        email:          spec.email,
        firstName:      spec.first,
        lastName:       spec.last,
        role:           spec.role,
        organizationId: spec.orgId,
        preferredLanguage: "en",
      },
    });
    users.push({ id: authId, email: spec.email, role: spec.role, organizationId: spec.orgId });
  }
  console.log(`   • ${users.length} users (Supabase + Prisma)`);

  /* ── B.3 — Properties ──────────────────────────────────────────────── */
  const propertyData: Array<{ name: string; orgId: string; city: string; floors: number }> = [
    { name: "Al Noor Residence", orgId: alNoor.id,         city: NEIGHBOURHOODS[0], floors: 5 },
    { name: "Khareef Suites",    orgId: alNoor.id,         city: NEIGHBOURHOODS[1], floors: 4 },
    { name: "Salalah Plaza",     orgId: alNoor.id,         city: NEIGHBOURHOODS[2], floors: 3 },
    { name: "Salalah Suites",    orgId: salalahSuites.id,  city: NEIGHBOURHOODS[1], floors: 3 },
  ];
  const properties: PropertyRef[] = [];
  for (const p of propertyData) {
    const created = await prisma.property.create({
      data: {
        name:           p.name,
        type:           "RESIDENTIAL",
        organizationId: p.orgId,
        city:           p.city,
        totalFloors:    p.floors,
        address:        `${p.city}, Salalah`,
      },
    });
    properties.push({ id: created.id, name: p.name, organizationId: p.orgId, city: p.city });
  }
  console.log(`   • ${properties.length} properties`);

  /* ── B.4 — Units (33 Al Noor + 6 Salalah Suites) ──────────────────── */
  const units: UnitRef[] = [];

  for (const spec of AL_NOOR_UNIT_MIX) {
    const prop = properties.find((p) => p.name === spec.property)!;
    const price = PRICE_TABLE[spec.type];
    const created = await prisma.unit.create({
      data: {
        name:       spec.name,
        unitType:   spec.type,
        floor:      spec.floor,
        bedrooms:   bedroomsFor(spec.type),
        bathrooms:  bathroomsFor(spec.type),
        basePrice:  price.daily,
        propertyId: prop.id,
      },
    });
    units.push({
      id: created.id, name: spec.name, propertyId: prop.id, organizationId: alNoor.id,
      unitType: spec.type, dailyRate: price.daily, monthlyRate: price.monthly,
    });
  }

  const ssProperty = properties.find((p) => p.name === "Salalah Suites")!;
  for (const spec of SALALAH_SUITES_UNITS) {
    const price = PRICE_TABLE[spec.type];
    const created = await prisma.unit.create({
      data: {
        name:       spec.name,
        unitType:   spec.type,
        floor:      spec.floor,
        bedrooms:   bedroomsFor(spec.type),
        bathrooms:  bathroomsFor(spec.type),
        basePrice:  price.daily,
        propertyId: ssProperty.id,
      },
    });
    units.push({
      id: created.id, name: spec.name, propertyId: ssProperty.id, organizationId: salalahSuites.id,
      unitType: spec.type, dailyRate: price.daily, monthlyRate: price.monthly,
    });
  }
  console.log(`   • ${units.length} units`);

  /* ── B.5 — Unit prices (1 DEFAULT + 3 SEASONAL per unit) ─────────── */
  let unitPriceCount = 0;
  for (const u of units) {
    await prisma.unitPrice.createMany({
      data: [
        // DEFAULT
        {
          priceType:   "DEFAULT",
          dailyRate:   u.dailyRate,
          monthlyRate: u.monthlyRate,
          priority:    1,
          isActive:    true,
          unitId:      u.id,
        },
        // SEASONAL — Khareef 2025 (1.6x daily)
        {
          priceType:   "SEASONAL",
          name:        "Khareef 2025",
          dailyRate:   round3(u.dailyRate * 1.6),
          monthlyRate: u.monthlyRate, // monthly unchanged for seasonal — only daily peaks
          startDate:   KHAREEF_2025.start,
          endDate:     KHAREEF_2025.end,
          priority:    20,
          isActive:    true,
          unitId:      u.id,
        },
        // SEASONAL — Khareef 2026 (1.6x daily)
        {
          priceType:   "SEASONAL",
          name:        "Khareef 2026",
          dailyRate:   round3(u.dailyRate * 1.6),
          monthlyRate: u.monthlyRate,
          startDate:   KHAREEF_2026.start,
          endDate:     KHAREEF_2026.end,
          priority:    20,
          isActive:    true,
          unitId:      u.id,
        },
        // SEASONAL — Eid Al Adha 2026 (1.3x daily)
        {
          priceType:   "SEASONAL",
          name:        "Eid Al Adha 2026",
          dailyRate:   round3(u.dailyRate * 1.3),
          monthlyRate: u.monthlyRate,
          startDate:   EID_2026.start,
          endDate:     EID_2026.end,
          priority:    25, // beats Khareef in the rare overlap case
          isActive:    true,
          unitId:      u.id,
        },
      ],
    });
    unitPriceCount += 4;
  }
  console.log(`   • ${unitPriceCount} unit prices`);

  /* ── B.6 — Expense categories (per org) ───────────────────────────── */
  let expenseCatCount = 0;
  for (const org of [alNoor, salalahSuites]) {
    await prisma.expenseCat.createMany({
      data: EXPENSE_CATEGORIES.map((c, i) => ({
        organizationId: org.id,
        name:           c.name,
        nameAr:         c.nameAr,
        icon:           c.icon,
        isSystem:       true,
        isActive:       true,
        sortOrder:      i,
      })),
    });
    expenseCatCount += EXPENSE_CATEGORIES.length;
  }
  console.log(`   • ${expenseCatCount} expense categories`);
  console.log("");

  return {
    orgs: [
      { id: alNoor.id, name: "Al Noor Property Management" },
      { id: salalahSuites.id, name: "Salalah Suites" },
    ],
    users,
    properties,
    units,
    unitPrices: unitPriceCount,
    expenseCats: expenseCatCount,
  };
}

/* ── helpers ─────────────────────────────────────────────────────────── */

function bedroomsFor(type: UnitRef["unitType"]): number {
  switch (type) {
    case "STUDIO":   return 0;
    case "ONE_BR":   return 1;
    case "TWO_BR":   return 2;
    case "THREE_BR": return 3;
    case "SUITE":    return 3;
  }
}

function bathroomsFor(type: UnitRef["unitType"]): number {
  switch (type) {
    case "STUDIO":   return 1;
    case "ONE_BR":   return 1;
    case "TWO_BR":   return 2;
    case "THREE_BR": return 2;
    case "SUITE":    return 3;
  }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

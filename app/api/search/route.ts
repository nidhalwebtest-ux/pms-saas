import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAccess } from "@/lib/access";
import { getSelectedPropertyId } from "@/lib/selected-property";
import { getEffectivePropertyIds } from "@/lib/property-scope";
import { Prisma } from "@prisma/client";

/* ============================================================================
 *  GET /api/search?q=<query>
 *
 *  Global command-palette search. Runs a small, capped query against every
 *  entity the user is allowed to VIEW, in parallel. Every branch is:
 *    1. Org-isolated       — organizationId (or property.organizationId) scope
 *    2. RBAC-filtered      — skipped entirely unless access.canView(entity)
 *    3. Building-scoped     — honours the header property selector AND the
 *                             per-user accessible-building set (never widens it)
 *
 *  Returns grouped, display-ready items so the client stays presentational.
 * ========================================================================= */

export const dynamic = "force-dynamic";

// Max rows returned per entity group.
const PER_GROUP = 5;

// Order groups appear in the palette (by likely search intent).
const GROUP_ORDER = [
  "reservation", "tenant", "invoice", "payment", "expense", "unit", "building",
] as const;

type EntityType = (typeof GROUP_ORDER)[number];

type SearchItem = {
  id: string;
  type: EntityType;
  title: string;
  subtitle: string;
  amount: number | null; // formatted with org currency on the client
  badge: string | null;  // raw enum value; localised + coloured on the client
  href: string;
};

const iContains = (q: string) => ({ contains: q, mode: "insensitive" as const });
const fullName = (t?: { firstName: string; lastName: string } | null) =>
  t ? `${t.firstName} ${t.lastName}`.trim() : "";
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const dec = (v: Prisma.Decimal | number | null | undefined) =>
  v == null ? null : Number(v);

export async function GET(req: NextRequest) {
  const access = await getSessionAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = access.organizationId;

  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  if (q.length < 1) return NextResponse.json({ q, groups: [] });

  // Building scope: honours the header selection, clamped to the user's
  // accessible buildings. null = unrestricted (all org buildings).
  const selectedProperty = await getSelectedPropertyId();
  const propertyIds = await getEffectivePropertyIds(selectedProperty || undefined);
  const hasBuildingFilter = propertyIds !== null;

  // A reservation belongs to a building via its primary unit OR any of its
  // (multi-unit) reservation_units rows.
  const resInBuilding: Prisma.ReservationWhereInput = {
    OR: [
      { unit: { propertyId: { in: propertyIds ?? [] } } },
      { reservationUnits: { some: { unit: { propertyId: { in: propertyIds ?? [] } } } } },
    ],
  };

  // Tenant text — reused to let "khalid" surface his reservations/invoices too.
  const tenantText = (s: string): Prisma.TenantWhereInput[] => [
    { firstName: iContains(s) },
    { lastName: iContains(s) },
    { phone: iContains(s) },
    { email: iContains(s) },
    { idNumber: iContains(s) },
  ];

  const can = (e: string) => access.canView(e);

  const tasks: Promise<{ type: EntityType; items: SearchItem[] }>[] = [];

  /* ── Tenants ──────────────────────────────────────────────────────── */
  if (can("tenants")) {
    tasks.push(
      prisma.tenant
        .findMany({
          where: {
            organizationId: orgId,
            AND: [
              hasBuildingFilter ? { reservations: { some: resInBuilding } } : {},
              { OR: tenantText(q) },
            ],
          },
          select: { id: true, firstName: true, lastName: true, phone: true, email: true },
          orderBy: { createdAt: "desc" },
          take: PER_GROUP,
        })
        .then((rows) => ({
          type: "tenant" as const,
          items: rows.map((t): SearchItem => ({
            id: t.id,
            type: "tenant",
            title: fullName(t) || t.phone || t.email || "—",
            subtitle: [t.phone, t.email].filter(Boolean).join(" · "),
            amount: null,
            badge: null,
            href: `/dashboard/tenants/${t.id}`,
          })),
        })),
    );
  }

  /* ── Reservations ─────────────────────────────────────────────────── */
  if (can("reservations")) {
    tasks.push(
      prisma.reservation
        .findMany({
          where: {
            organizationId: orgId,
            AND: [
              hasBuildingFilter ? resInBuilding : {},
              { OR: [{ reservationNumber: iContains(q) }, { tenant: { OR: tenantText(q) } }] },
            ],
          },
          select: {
            id: true, reservationNumber: true, status: true, startDate: true,
            endDate: true, grandTotal: true,
            tenant: { select: { firstName: true, lastName: true } },
          },
          orderBy: { startDate: "desc" },
          take: PER_GROUP,
        })
        .then((rows) => ({
          type: "reservation" as const,
          items: rows.map((r): SearchItem => ({
            id: r.id,
            type: "reservation",
            title: r.reservationNumber || fullName(r.tenant) || "—",
            subtitle: [fullName(r.tenant), `${isoDate(r.startDate)} → ${isoDate(r.endDate)}`]
              .filter(Boolean).join(" · "),
            amount: dec(r.grandTotal),
            badge: r.status,
            href: `/dashboard/reservations/${r.id}`,
          })),
        })),
    );
  }

  /* ── Invoices ─────────────────────────────────────────────────────── */
  if (can("invoices")) {
    tasks.push(
      prisma.invoice
        .findMany({
          where: {
            organizationId: orgId,
            AND: [
              hasBuildingFilter ? { reservation: resInBuilding } : {},
              { OR: [{ invoiceNumber: iContains(q) }, { tenant: { OR: tenantText(q) } }] },
            ],
          },
          select: {
            id: true, invoiceNumber: true, status: true, totalAmount: true,
            balanceDue: true, tenant: { select: { firstName: true, lastName: true } },
          },
          orderBy: { createdAt: "desc" },
          take: PER_GROUP,
        })
        .then((rows) => ({
          type: "invoice" as const,
          items: rows.map((r): SearchItem => ({
            id: r.id,
            type: "invoice",
            title: r.invoiceNumber,
            subtitle: fullName(r.tenant),
            amount: dec(r.totalAmount),
            badge: r.status,
            href: `/dashboard/invoices/${r.id}`,
          })),
        })),
    );
  }

  /* ── Payments ─────────────────────────────────────────────────────── */
  if (can("payments")) {
    tasks.push(
      prisma.payment
        .findMany({
          where: {
            organizationId: orgId,
            AND: [
              hasBuildingFilter ? { reservation: resInBuilding } : {},
              {
                OR: [
                  { paymentNumber: iContains(q) },
                  { reference: iContains(q) },
                  { tenant: { OR: tenantText(q) } },
                ],
              },
            ],
          },
          select: {
            id: true, paymentNumber: true, reference: true, method: true,
            amount: true, date: true, tenant: { select: { firstName: true, lastName: true } },
          },
          orderBy: { date: "desc" },
          take: PER_GROUP,
        })
        .then((rows) => ({
          type: "payment" as const,
          items: rows.map((r): SearchItem => ({
            id: r.id,
            type: "payment",
            title: r.paymentNumber || r.reference || "—",
            subtitle: [fullName(r.tenant), isoDate(r.date)].filter(Boolean).join(" · "),
            amount: dec(r.amount),
            badge: r.method,
            href: `/dashboard/payments/${r.id}`,
          })),
        })),
    );
  }

  /* ── Expenses ─────────────────────────────────────────────────────── */
  if (can("expenses")) {
    tasks.push(
      prisma.expense
        .findMany({
          where: {
            organizationId: orgId,
            AND: [
              hasBuildingFilter ? { propertyId: { in: propertyIds ?? [] } } : {},
              { OR: [{ expenseNumber: iContains(q) }, { description: iContains(q) }] },
            ],
          },
          select: {
            id: true, expenseNumber: true, description: true, amount: true,
            status: true, property: { select: { name: true } },
          },
          orderBy: { submittedAt: "desc" },
          take: PER_GROUP,
        })
        .then((rows) => ({
          type: "expense" as const,
          items: rows.map((r): SearchItem => ({
            id: r.id,
            type: "expense",
            title: r.expenseNumber,
            subtitle: [r.description, r.property?.name].filter(Boolean).join(" · "),
            amount: dec(r.amount),
            badge: r.status,
            href: `/dashboard/expenses/${r.id}`,
          })),
        })),
    );
  }

  /* ── Units ────────────────────────────────────────────────────────── */
  if (can("units")) {
    tasks.push(
      prisma.unit
        .findMany({
          where: {
            property: { organizationId: orgId },
            AND: [
              hasBuildingFilter ? { propertyId: { in: propertyIds ?? [] } } : {},
              { OR: [{ name: iContains(q) }, { description: iContains(q) }] },
            ],
          },
          select: {
            id: true, name: true, bedrooms: true, status: true,
            property: { select: { id: true, name: true } },
          },
          orderBy: { name: "asc" },
          take: PER_GROUP,
        })
        .then((rows) => ({
          type: "unit" as const,
          items: rows.map((u): SearchItem => ({
            id: u.id,
            type: "unit",
            title: u.name,
            subtitle: u.property?.name ?? "",
            amount: null,
            badge: u.status,
            href: u.property ? `/dashboard/properties/${u.property.id}` : "/dashboard/units",
          })),
        })),
    );
  }

  /* ── Buildings ────────────────────────────────────────────────────── */
  if (can("buildings")) {
    tasks.push(
      prisma.property
        .findMany({
          where: {
            organizationId: orgId,
            isArchived: false,
            AND: [
              hasBuildingFilter ? { id: { in: propertyIds ?? [] } } : {},
              { OR: [{ name: iContains(q) }, { address: iContains(q) }, { city: iContains(q) }] },
            ],
          },
          select: { id: true, name: true, address: true, city: true },
          orderBy: { name: "asc" },
          take: PER_GROUP,
        })
        .then((rows) => ({
          type: "building" as const,
          items: rows.map((p): SearchItem => ({
            id: p.id,
            type: "building",
            title: p.name,
            subtitle: [p.address, p.city].filter(Boolean).join(" · "),
            amount: null,
            badge: null,
            href: `/dashboard/properties/${p.id}`,
          })),
        })),
    );
  }

  const settled = await Promise.all(tasks);
  const byType = new Map(settled.map((g) => [g.type, g.items]));

  const groups = GROUP_ORDER
    .map((type) => ({ type, items: byType.get(type) ?? [] }))
    .filter((g) => g.items.length > 0);

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return NextResponse.json({ q, total, groups });
}

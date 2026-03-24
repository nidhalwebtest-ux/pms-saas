import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { getDisplayStatus, type StoredStatus } from "@/lib/reservation-status";

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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const r = await prisma.reservation.findUnique({
    where: { id },
    include: {
      tenant: {
        select: {
          id: true, firstName: true, lastName: true, fullNameArabic: true,
          phone: true, whatsappNumber: true, email: true,
          nationality: true, classification: true, tenantType: true,
          corporateName: true, idType: true, idNumber: true, idExpiryDate: true,
          specialRequests: true, internalNotes: true,
          totalStays: true, totalSpent: true, firstStayDate: true,
          organizationId: true,
        },
      },
      unit: {
        include: { property: { select: { id: true, name: true } } },
      },
      reservationUnits: {
        include: {
          unit: {
            select: {
              id: true, name: true, floor: true, unitType: true,
              property: { select: { id: true, name: true } },
            },
          },
        },
      },
      payments: {
        orderBy: { date: "asc" },
        include: { invoice: { select: { id: true, invoiceNumber: true } } },
      },
      charges: {
        orderBy: { createdAt: "asc" },
        include: { createdBy: { select: { firstName: true, lastName: true } } },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { performedBy: { select: { firstName: true, lastName: true } } },
      },
      createdBy: { select: { firstName: true, lastName: true } },
    },
  });

  if (!r) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (r.tenant.organizationId !== actor.organizationId)
    return NextResponse.json({ error: "Not found." }, { status: 404 });

  const dsInfo = getDisplayStatus(r.status as StoredStatus, r.startDate, r.endDate);

  // Merge units (legacy + junction table)
  const seen = new Set<string>();
  const units: {
    id: string; name: string; floor: number; unitType: string;
    propertyId: string; propertyName: string;
    rateType: string; rateAmount: string; rateSource: string;
    seasonalPriceName: string | null; nights: number; subtotal: string;
  }[] = [];

  if (r.unit) {
    const ru = r.reservationUnits.find((x) => x.unitId === r.unit!.id);
    seen.add(r.unit.id);
    units.push({
      id: r.unit.id, name: r.unit.name, floor: r.unit.floor,
      unitType: r.unit.unitType,
      propertyId: r.unit.property.id, propertyName: r.unit.property.name,
      rateType: ru?.rateType ?? r.rateType,
      rateAmount: ru ? ru.rateAmount.toString() : "0",
      rateSource: ru?.rateSource ?? "default_price",
      seasonalPriceName: ru?.seasonalPriceName ?? null,
      nights: ru?.nights ?? r.totalNights,
      subtotal: ru ? ru.subtotal.toString() : Number(r.grandTotal).toFixed(3),
    });
  }
  for (const ru of r.reservationUnits) {
    if (!seen.has(ru.unitId)) {
      seen.add(ru.unitId);
      units.push({
        id: ru.unit.id, name: ru.unit.name, floor: ru.unit.floor,
        unitType: ru.unit.unitType,
        propertyId: ru.unit.property.id, propertyName: ru.unit.property.name,
        rateType: ru.rateType, rateAmount: ru.rateAmount.toString(),
        rateSource: ru.rateSource, seasonalPriceName: ru.seasonalPriceName,
        nights: ru.nights, subtotal: ru.subtotal.toString(),
      });
    }
  }

  const grandTotal   = Number(r.grandTotal ?? r.totalPrice ?? 0);
  const amountPaid   = Number(r.amountPaid ?? 0);
  const chargesTotal = r.charges.reduce((s, c) => s + Number(c.amount), 0);

  return NextResponse.json({
    id: r.id,
    reservationNumber: r.reservationNumber,
    status: r.status,
    displayStatus: dsInfo.label,
    displayStatusBadgeClass: dsInfo.badgeClass,
    displayStatusRowClass: dsInfo.rowClass,
    displayStatusPriority: dsInfo.priority,
    displayStatusUrgent: dsInfo.urgent,
    displayStatusPulse: dsInfo.pulse,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate.toISOString(),
    actualCheckIn: r.actualCheckIn?.toISOString() ?? null,
    actualCheckOut: r.actualCheckOut?.toISOString() ?? null,
    totalNights: r.totalNights,
    rateType: r.rateType,
    source: r.source,
    notes: r.notes,
    cancelledReason: r.cancelledReason,
    cancelledAt: r.cancelledAt?.toISOString() ?? null,
    totalAmount: Number(r.totalAmount).toFixed(3),
    discountAmount: Number(r.discountAmount).toFixed(3),
    taxAmount: Number(r.taxAmount).toFixed(3),
    grandTotal: grandTotal.toFixed(3),
    amountPaid: amountPaid.toFixed(3),
    balanceDue: Math.max(0, grandTotal + chargesTotal - amountPaid).toFixed(3),
    chargesTotal: chargesTotal.toFixed(3),
    tenant: {
      id: r.tenant.id,
      firstName: r.tenant.firstName,
      lastName: r.tenant.lastName,
      fullNameArabic: r.tenant.fullNameArabic,
      phone: r.tenant.phone,
      whatsappNumber: r.tenant.whatsappNumber,
      email: r.tenant.email,
      nationality: r.tenant.nationality,
      classification: r.tenant.classification,
      tenantType: r.tenant.tenantType,
      corporateName: r.tenant.corporateName,
      idType: r.tenant.idType,
      idNumber: r.tenant.idNumber,
      specialRequests: r.tenant.specialRequests,
      internalNotes: r.tenant.internalNotes,
      totalStays: r.tenant.totalStays,
      totalSpent: r.tenant.totalSpent.toString(),
      idExpiryDate: r.tenant.idExpiryDate?.toISOString() ?? null,
      firstStayDate: r.tenant.firstStayDate?.toISOString() ?? null,
    },
    units,
    payments: r.payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount).toFixed(3),
      date: p.date.toISOString(),
      method: p.method,
      reference: p.reference,
      notes: p.notes,
      invoiceNumber: p.invoice?.invoiceNumber ?? null,
    })),
    charges: r.charges.map((c) => ({
      id: c.id,
      description: c.description,
      amount: Number(c.amount).toFixed(3),
      category: c.category,
      createdAt: c.createdAt.toISOString(),
      createdByName: c.createdBy
        ? `${c.createdBy.firstName ?? ""} ${c.createdBy.lastName ?? ""}`.trim()
        : null,
    })),
    activities: r.activities.map((a) => ({
      id: a.id,
      action: a.action,
      description: a.description,
      performedByName: a.performedBy
        ? `${a.performedBy.firstName ?? ""} ${a.performedBy.lastName ?? ""}`.trim()
        : null,
      createdAt: a.createdAt.toISOString(),
      metadata: a.metadata,
    })),
    createdByName: r.createdBy
      ? `${r.createdBy.firstName ?? ""} ${r.createdBy.lastName ?? ""}`.trim()
      : null,
    createdAt: r.createdAt.toISOString(),
  });
}

import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSuperAdmin } from "@/lib/super-admin";
import OrganizationDetailClient, {
  OrganizationDetailData,
} from "./OrganizationDetailClient";

export default async function AdminOrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await getSuperAdmin())) redirect("/dashboard");
  const { id } = await params;

  const [org, units, payments] = await Promise.all([
    prisma.organization.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            role: true,
            createdAt: true,
            assignedRole: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        properties: {
          select: {
            id: true,
            name: true,
            type: true,
            address: true,
            city: true,
            totalFloors: true,
            isActive: true,
            createdAt: true,
            _count: { select: { units: true } },
          },
          orderBy: { name: "asc" },
        },
        tenants: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            fullNameArabic: true,
            phone: true,
            email: true,
            nationality: true,
            classification: true,
            tenantType: true,
            totalStays: true,
            totalSpent: true,
            isActive: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        reservations: {
          select: {
            id: true,
            reservationNumber: true,
            startDate: true,
            endDate: true,
            status: true,
            rateType: true,
            totalNights: true,
            grandTotal: true,
            amountPaid: true,
            createdAt: true,
            tenant: { select: { firstName: true, lastName: true } },
            unit: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: {
            invoices: true,
            expenses: true,
          },
        },
      },
    }),
    prisma.unit.findMany({
      where: { property: { organizationId: id } },
      select: {
        id: true,
        name: true,
        unitType: true,
        floor: true,
        bedrooms: true,
        bathrooms: true,
        basePrice: true,
        status: true,
        isActive: true,
        property: { select: { name: true } },
      },
      orderBy: [{ property: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.payment.findMany({
      where: { organizationId: id },
      select: {
        id: true,
        paymentNumber: true,
        amount: true,
        date: true,
        method: true,
        reference: true,
        notes: true,
        tenant: { select: { firstName: true, lastName: true } },
      },
      orderBy: { date: "desc" },
    }),
  ]);

  if (!org) notFound();

  const data: OrganizationDetailData = {
    id: org.id,
    name: org.name,
    phone: org.phone,
    address: org.address,
    city: org.city,
    area: org.area,
    currency: org.currency,
    timezone: org.timezone,
    pdfBrandColor: org.pdfBrandColor,
    plan: org.plan,
    subscriptionStatus: org.subscriptionStatus,
    maxProperties: org.maxProperties,
    checkInPolicy: org.checkInPolicy,
    autoCheckout: org.autoCheckout,
    showReservedStatus: org.showReservedStatus,
    dailyInvoiceTiming: org.dailyInvoiceTiming,
    monthlyInvoiceTiming: org.monthlyInvoiceTiming,
    createdAt: org.createdAt.toISOString(),
    metrics: {
      users: org.users.length,
      properties: org.properties.length,
      units: units.length,
      tenants: org.tenants.length,
      reservations: org.reservations.length,
      invoices: org._count.invoices,
      payments: payments.length,
      expenses: org._count.expenses,
    },
    users: org.users.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      phone: u.phone,
      role: u.role,
      assignedRoleName: u.assignedRole?.name ?? null,
      createdAt: u.createdAt.toISOString(),
    })),
    properties: org.properties.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      address: p.address,
      city: p.city,
      totalFloors: p.totalFloors,
      isActive: p.isActive,
      unitsCount: p._count.units,
      createdAt: p.createdAt.toISOString(),
    })),
    units: units.map((u) => ({
      id: u.id,
      name: u.name,
      unitType: u.unitType,
      floor: u.floor,
      bedrooms: u.bedrooms,
      bathrooms: u.bathrooms,
      basePrice: Number(u.basePrice),
      status: u.status,
      isActive: u.isActive,
      propertyName: u.property.name,
    })),
    tenants: org.tenants.map((t) => ({
      id: t.id,
      name: `${t.firstName} ${t.lastName}`.trim(),
      fullNameArabic: t.fullNameArabic,
      phone: t.phone,
      email: t.email,
      nationality: t.nationality,
      classification: t.classification,
      tenantType: t.tenantType,
      totalStays: t.totalStays,
      totalSpent: Number(t.totalSpent),
      isActive: t.isActive,
      createdAt: t.createdAt.toISOString(),
    })),
    reservations: org.reservations.map((r) => ({
      id: r.id,
      reservationNumber: r.reservationNumber,
      tenantName: r.tenant ? `${r.tenant.firstName} ${r.tenant.lastName}`.trim() : "—",
      unitName: r.unit?.name ?? null,
      startDate: r.startDate.toISOString(),
      endDate: r.endDate.toISOString(),
      status: r.status,
      rateType: r.rateType,
      totalNights: r.totalNights,
      grandTotal: Number(r.grandTotal),
      amountPaid: Number(r.amountPaid),
      createdAt: r.createdAt.toISOString(),
    })),
    payments: payments.map((p) => ({
      id: p.id,
      paymentNumber: p.paymentNumber,
      tenantName: p.tenant ? `${p.tenant.firstName} ${p.tenant.lastName}`.trim() : "—",
      amount: Number(p.amount),
      date: p.date.toISOString(),
      method: p.method,
      reference: p.reference,
      notes: p.notes,
    })),
  };

  return <OrganizationDetailClient data={data} />;
}
